'use strict';
/**
 * src/webhooks/telegram.js
 *
 * Purpose:
 * - Implements Telegram Bot API webhook verification and message ingestion.
 * - Converts inbound Telegram messages into our database schema.
 * - Ensures idempotency to safely handle Telegram retries.
 * - Emits realtime events for agent notifications.
 *
 * Algorithm:
 * 1) Verify webhook signature (secret_token header)
 * 2) Extract message data from Telegram update
 * 3) Upsert channel (type='telegram', external_id=bot_token)
 * 4) Upsert contact (external_id=user_id)
 * 5) Find or create conversation
 * 6) Insert message with idempotency on external_message_id
 * 7) Handle media attachments
 * 8) Emit realtime events
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getIO } = require('../realtime/io');
const crypto = require('crypto');
const telegramClient = require('../integrations/telegram/telegramClient');
const translation = require('../services/translation');
const { triggerWorkflowsForEvent } = require('../services/workflows');
const { evaluateMessageRules } = require('../services/rules');
const aiService = require('../services/aiService');

/**
 * GET /webhooks/telegram
 * Health check endpoint
 */
router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'telegram-webhook' });
});

/**
 * POST /webhooks/telegram
 * Ingest inbound Telegram messages
 */
router.post('/', async (req, res, next) => {
  const body = req.body || {};

  try {
    // Verify secret token if configured
    const secretToken = req.headers['x-telegram-bot-api-secret-token'] || '';
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
    
    if (expectedSecret && secretToken !== expectedSecret) {
      console.error('[Telegram Webhook] Invalid secret token');
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Extract update ID for idempotency
    const updateId = body.update_id;
    if (!updateId) {
      console.warn('[Telegram Webhook] No update_id in payload');
      return res.status(200).json({ ok: true });
    }

    // Check if this is a message update
    if (!body.message) {
      console.log('[Telegram Webhook] Non-message update, ignoring');
      return res.status(200).json({ ok: true });
    }

    const message = body.message;
    const chat = message.chat || {};
    const from = message.from || {};
    const messageId = message.message_id;
    const chatId = chat.id;
    const userId = from.id;
    const userName = from.username || from.first_name || 'User';

    if (!chatId || !userId) {
      console.warn('[Telegram Webhook] Missing chat_id or user_id');
      return res.status(200).json({ ok: true });
    }

    console.log(`[Telegram Webhook] Processing message ${messageId} from user ${userId} in chat ${chatId}`);

    // Get bot token from environment (for now, single bot)
    // In production, you might store multiple bot tokens per team
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[Telegram Webhook] TELEGRAM_BOT_TOKEN not configured');
      return res.status(500).json({ error: 'Bot not configured' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Upsert channel (type='telegram', external_id=bot_token)
      const channelResult = await client.query(
        `
        INSERT INTO channels (id, type, name, external_id, config, active)
        VALUES (gen_random_uuid(), 'telegram', $1, $2, '{}'::jsonb, TRUE)
        ON CONFLICT (type, external_id)
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id
        `,
        ['Telegram Bot', botToken]
      );
      const channelId = channelResult.rows[0].id;

      // Upsert contact (external_id=user_id)
      const contactResult = await client.query(
        `
        INSERT INTO contacts (id, channel_id, external_id, display_name, profile)
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        ON CONFLICT (channel_id, external_id)
        DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, contacts.display_name)
        RETURNING id, profile
        `,
        [channelId, String(userId), userName, JSON.stringify({ telegram_user_id: userId, username: from.username })]
      );
      const contactId = contactResult.rows[0].id;
      const existingProfile = contactResult.rows[0].profile || {};

      // Check if contact is blocked
      if (existingProfile.blocked === true) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(200).json({ ok: true });
      }

      // Check if this is the first message
      const historyRes = await client.query(
        `SELECT 1 FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.contact_id = $1 LIMIT 1`,
        [contactId]
      );
      const isFirstMessage = (historyRes.rowCount === 0);

      // Find or create conversation
      let conversationId;
      const existingConv = await client.query(
        `
        SELECT id FROM conversations
        WHERE channel_id = $1 AND contact_id = $2 AND status = 'open'
        ORDER BY created_at ASC
        LIMIT 1
        `,
        [channelId, contactId]
      );
      if (existingConv.rowCount > 0) {
        conversationId = existingConv.rows[0].id;
      } else {
        const convInsert = await client.query(
          `
          INSERT INTO conversations (id, channel_id, contact_id, status, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, 'open', NOW(), NOW())
          RETURNING id
          `,
          [channelId, contactId]
        );
        conversationId = convInsert.rows[0].id;
      }

      // Extract message content
      let textBody = null;
      let contentType = 'text';

      if (message.text) {
        textBody = message.text;
        contentType = 'text';
      } else if (message.photo) {
        contentType = 'image';
        textBody = message.caption || '[Photo]';
      } else if (message.document) {
        contentType = 'document';
        textBody = message.caption || '[Document]';
      } else if (message.audio) {
        contentType = 'audio';
        textBody = message.caption || '[Audio]';
      } else if (message.video) {
        contentType = 'video';
        textBody = message.caption || '[Video]';
      } else if (message.voice) {
        contentType = 'audio';
        textBody = '[Voice Message]';
      } else if (message.sticker) {
        contentType = 'sticker';
        textBody = '[Sticker]';
      } else if (message.location) {
        contentType = 'location';
        textBody = `[Location: ${message.location.latitude}, ${message.location.longitude}]`;
      } else if (message.contact) {
        contentType = 'contact';
        textBody = `[Contact: ${message.contact.first_name}]`;
      } else {
        textBody = '[Unsupported message type]';
      }

      // Detect language and translate if needed
      let translationMeta = null;
      if (textBody) {
        try {
          translationMeta = await translation.detectAndTranslateToEnglish(textBody);
        } catch (e) {
          translationMeta = null;
        }
      }

      // Build raw message payload
      const rawMsg = { ...message };
      if (translationMeta && translationMeta.languageCode && translationMeta.englishText) {
        rawMsg.translation = {
          languageCode: translationMeta.languageCode,
          englishText: translationMeta.englishText,
          originalText: textBody
        };
        if (translationMeta.languageCode !== 'en') {
          try {
            await client.query(
              `
              UPDATE contacts
              SET profile = jsonb_set(
                COALESCE(profile, '{}'),
                '{preferred_language}',
                to_jsonb($1::text),
                true
              )
              WHERE id = $2
              `,
              [translationMeta.languageCode, contactId]
            );
          } catch (_) {}
        }
      }

      // Insert message with idempotency
      const externalMessageId = `telegram_${chatId}_${messageId}`;
      const messageResult = await client.query(
        `
        INSERT INTO messages (
          id, conversation_id, channel_id, direction, content_type,
          external_message_id, text_body, delivery_status, author_user_id,
          raw_payload, is_deleted, created_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, 'inbound', $3,
          $4, $5, NULL, NULL,
          $6::jsonb, FALSE, NOW()
        )
        ON CONFLICT (channel_id, external_message_id)
        DO NOTHING
        RETURNING id
        `,
        [conversationId, channelId, contentType, externalMessageId, textBody, JSON.stringify(rawMsg)]
      );

      let messageIdDb = null;
      if (messageResult.rowCount > 0) {
        messageIdDb = messageResult.rows[0].id;
      }

      // Handle media attachments
      const attachments = [];
      if (messageIdDb) {
        if (message.photo && message.photo.length > 0) {
          const photo = message.photo[message.photo.length - 1]; // Get largest photo
          const attRes = await client.query(
            `
            INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
            VALUES (gen_random_uuid(), $1, 'image', $2, $3, NOW())
            RETURNING id, kind, url, mime_type
            `,
            [messageIdDb, photo.file_id, 'image/jpeg']
          );
          attachments.push(attRes.rows[0]);
        } else if (message.document) {
          const attRes = await client.query(
            `
            INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
            VALUES (gen_random_uuid(), $1, 'document', $2, $3, NOW())
            RETURNING id, kind, url, mime_type
            `,
            [messageIdDb, message.document.file_id, message.document.mime_type || 'application/octet-stream']
          );
          attachments.push(attRes.rows[0]);
        } else if (message.audio) {
          const attRes = await client.query(
            `
            INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
            VALUES (gen_random_uuid(), $1, 'audio', $2, $3, NOW())
            RETURNING id, kind, url, mime_type
            `,
            [messageIdDb, message.audio.file_id, message.audio.mime_type || 'audio/mpeg']
          );
          attachments.push(attRes.rows[0]);
        } else if (message.video) {
          const attRes = await client.query(
            `
            INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
            VALUES (gen_random_uuid(), $1, 'video', $2, $3, NOW())
            RETURNING id, kind, url, mime_type
            `,
            [messageIdDb, message.video.file_id, message.video.mime_type || 'video/mp4']
          );
          attachments.push(attRes.rows[0]);
        }
      }

      // Update conversation last_message_at
      await client.query(
        `
        UPDATE conversations
        SET last_message_at = NOW(), updated_at = NOW()
        WHERE id = $1
        `,
        [conversationId]
      );

      await client.query('COMMIT');
      client.release();

      // Trigger workflows for first message
      if (isFirstMessage) {
        try {
          await triggerWorkflowsForEvent('first_message', String(userId), { conversationId, channelId });
        } catch (e) {
          console.error('[WorkflowEvents] Failed to trigger first_message workflows:', e);
        }
      }

      // Evaluate message rules
      try {
        if (textBody) {
          await evaluateMessageRules(String(userId), textBody, channelId);
        }
      } catch (e) {
        console.error('[Rules] Failed to evaluate message rules:', e);
      }

      // Emit realtime event
      const io = getIO();
      if (io && messageIdDb) {
        const payload = {
          conversationId,
          messageId: messageIdDb,
          contentType,
          textBody,
          direction: 'inbound',
          attachments,
          rawPayload: rawMsg,
          translation: rawMsg.translation || null
        };
        io.to(`conversation:${conversationId}`).emit('message:new', payload);
        io.emit('message:new', payload);
      }

      // AI Agent Integration (async, non-blocking)
      if (textBody && !isFirstMessage) {
        (async () => {
          try {
            const aiConfigCheck = await db.query('SELECT is_active FROM ai_agent_config LIMIT 1');
            const isGlobalAiActive = aiConfigCheck.rows.length > 0 && aiConfigCheck.rows[0].is_active === true;
            
            if (!isGlobalAiActive) {
              return;
            }

            const convAiCheck = await db.query('SELECT is_ai_active FROM conversations WHERE id = $1', [conversationId]);
            const isConvAiActive = convAiCheck.rows.length > 0 && convAiCheck.rows[0].is_ai_active !== false;
            
            if (!isConvAiActive) {
              return;
            }

            await new Promise(r => setTimeout(r, 1000));
            
            const aiResponse = await aiService.handleIncomingMessage(conversationId, textBody);
            if (aiResponse) {
              console.log(`[AI Agent] Generated response for ${conversationId}:`, aiResponse);
              // Send via Telegram
              await telegramClient.sendText(botToken, chatId, aiResponse);
            }
          } catch (aiErr) {
            console.error('[AI Agent] Failed to generate/send response:', aiErr);
          }
        })();
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      client.release();
      throw err;
    }
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err.message);
    err.status = 500;
    err.expose = false;
    return next(err);
  }
});

module.exports = router;
