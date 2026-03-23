'use strict';
/**
 * src/webhooks/whatsapp.js
 *
 * Purpose:
 * - Implements WhatsApp Cloud API webhook verification (GET) and ingestion (POST).
 * - Converts inbound WhatsApp messages (text, image, audio, document) into our DB schema.
 * - Ensures idempotency to safely handle Meta retries and duplicate deliveries.
 * - Emits realtime events so online agents see new messages instantly.
 *
 * Algorithm overview (high level):
 * - Verification:
 *   1) Meta calls GET with hub.mode, hub.verify_token, hub.challenge.
 *   2) We compare hub.verify_token with our env token. If valid, echo hub.challenge (200).
 *   3) Otherwise, return 403.
 *
 * - Ingestion:
 *   1) Meta POSTs webhook JSON containing entries with changes.value.messages.
 *   2) For each message:
 *      a) Extract phone_number_id (channel external_id) and the sender wa_id (contact external_id).
 *      b) Upsert channel (type='whatsapp', external_id=phone_number_id).
 *      c) Upsert contact linked to that channel.
 *      d) Find an open conversation for (channel, contact); if none, create one.
 *      e) Insert message with unique (channel_id, external_message_id) idempotency.
 *      f) If message has media (image/audio/document), insert attachment records.
 *      g) Update conversation.last_message_at.
 *      h) Emit realtime event to appropriate rooms (e.g., conversation and team).
 *   3) If duplicates arrive (same external_message_id), the unique constraint prevents double insertion.
 *   4) Respond 200 quickly so Meta does not retry unnecessarily.
 *
 * Idempotency and Meta retry logic:
 * - Meta may retry delivery on transient errors. Our inserts use unique keys on external IDs.
 * - If DB is down or a critical error happens, we return 500 so Meta retries later.
 * - If duplicates arrive, we still return 200 to signal success and avoid noisy reprocessing.
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const { getIO } = require('../realtime/io');
const crypto = require('crypto');
const axios = require('axios');
const translation = require('../services/translation');
const { triggerWorkflowsForEvent } = require('../services/workflows');
const { evaluateMessageRules, evaluateCourseRules } = require('../services/rules');
const aiService = require('../services/aiService');
const outboundWhatsApp = require('../services/outboundWhatsApp');

// Verify token for GET challenge.
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const APP_SECRET = process.env.META_APP_SECRET || '';

/**
 * GET /webhooks/whatsapp
 * Webhook verification endpoint required by Meta.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    // Echo the challenge string exactly to confirm subscription.
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Forbidden' });
});

/**
 * POST /webhooks/whatsapp
 * Ingest inbound messages.
 *
 * Important notes:
 * - Process each message independently in its own transaction to localize failures.
 * - If any critical step fails for a given message, we throw to allow Meta to retry.
 * - For duplicates: ON CONFLICT DO NOTHING ensures safe reprocessing.
 */
router.post('/', async (req, res, next) => {
  // Basic shape check; avoid crashing on unexpected payloads.
  const body = req.body || {};
  /**
   * Webhook signature verification:
   * - Meta sends X-Hub-Signature-256: "sha256=HEX_DIGEST".
   * - Compute HMAC of raw body using APP_SECRET and compare.
   * - Reject if missing or mismatched to prevent spoofed requests.
   */
  try {
    const header = req.headers['x-hub-signature-256'] || '';
    const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody || '').digest('hex');
    if (!APP_SECRET) {
      console.error('[WhatsApp Webhook] Missing process.env.META_APP_SECRET');
    } else if (header !== expected) {
      console.error(`[WhatsApp Webhook] Invalid signature. Expected: ${expected}, Received: ${header}`);
      const err = new Error('Invalid webhook signature');
      err.status = 403;
      err.expose = true;
      throw err;
    }
  } catch (sigErr) {
    return next(sigErr);
  }
  try {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    console.log(`[WhatsApp Webhook] Received payload with ${entries.length} entries`);
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change && change.value ? change.value : {};
        const messages = Array.isArray(value.messages) ? value.messages : [];
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        const metadata = value.metadata || {};
        const phoneNumberId = metadata.phone_number_id; // channel external_id
        console.log(`[WhatsApp Webhook] Entry change for phoneNumberId: ${phoneNumberId}, messages: ${messages.length}, statuses: ${statuses.length}`);

        if (statuses.length > 0) {
          try {
            const io = getIO();
            for (const st of statuses) {
              const externalMessageId = st && st.id ? String(st.id) : null;
              const status = st && st.status ? String(st.status) : null;
              if (!externalMessageId || !status) continue;

              const metaStatus = {
                status,
                timestamp: st.timestamp || null,
                recipient_id: st.recipient_id || null,
                errors: Array.isArray(st.errors) ? st.errors : null,
              };

              const ts = st.timestamp ? new Date(Number(st.timestamp) * 1000) : null;
              const sentAt = status === 'sent' ? ts : null;
              const deliveredAt = status === 'delivered' ? ts : null;
              const readAt = status === 'read' ? ts : null;

              const upd = await db.query(
                `
                UPDATE messages
                SET delivery_status = $2,
                    sent_at = COALESCE($3, sent_at),
                    delivered_at = COALESCE($4, delivered_at),
                    read_at = COALESCE($5, read_at),
                    raw_payload = jsonb_set(COALESCE(raw_payload, '{}'::jsonb), '{meta_status}', $6::jsonb, true)
                WHERE external_message_id = $1
                RETURNING id, conversation_id
                `,
                [externalMessageId, status, sentAt, deliveredAt, readAt, JSON.stringify(metaStatus)]
              );

              if (io && upd.rowCount > 0) {
                const row = upd.rows[0];
                io.to(`conversation:${row.conversation_id}`).emit('message:status', {
                  conversationId: row.conversation_id,
                  messageId: row.id,
                  status,
                  meta: metaStatus,
                });
                io.emit('message:status', {
                  conversationId: row.conversation_id,
                  messageId: row.id,
                  status,
                  meta: metaStatus,
                });
              }
            }
          } catch (e) {
            console.error('[WhatsApp Webhook] Failed to process status updates:', e.message);
          }
        }

        if (!phoneNumberId) {
          continue;
        }

        for (const msg of messages) {
          let textBody = null;
          if (msg.type === 'text' && msg.text) {
            textBody = msg.text.body;
          } else if (msg.type === 'interactive' && msg.interactive) {
            if (msg.interactive.type === 'button_reply' && msg.interactive.button_reply) {
              textBody = msg.interactive.button_reply.title;
            } else if (msg.interactive.type === 'list_reply' && msg.interactive.list_reply) {
              textBody = msg.interactive.list_reply.title;
            }
          } else if (msg.type === 'button' && msg.button) {
            textBody = msg.button.text;
          }

          let translationMeta = null;
          if (textBody) {
            try {
              translationMeta = await translation.detectAndTranslateToEnglish(textBody);
            } catch (e) {
              translationMeta = null;
            }
          }

          const client = await db.getClient();
          try {
            await client.query('BEGIN');

            // Upsert channel (type=whatsapp, external_id=phoneNumberId)
            const channelResult = await client.query(
              `
              INSERT INTO channels (id, type, name, external_id, config, active)
              VALUES (gen_random_uuid(), 'whatsapp', $1, $2, '{}'::jsonb, TRUE)
              ON CONFLICT (type, external_id)
              DO UPDATE SET name = EXCLUDED.name
              RETURNING id
              `,
              [metadata.display_phone_number || 'WhatsApp Number', phoneNumberId]
            );
            const channelId = channelResult.rows[0].id;

            // Determine sender (contact external_id) and profile name.
            // For inbound messages, "from" is the contact's wa_id.
            const senderWaId = msg.from;
            const profileName =
              Array.isArray(value.contacts) &&
              value.contacts[0] &&
              value.contacts[0].profile &&
              value.contacts[0].profile.name
                ? value.contacts[0].profile.name
                : null;

            if (!senderWaId) {
              // Without sender, we cannot associate a contact; skip this message.
              await client.query('ROLLBACK');
              client.release();
              continue;
            }

            // Upsert contact for (channel_id, external_id=wa_id)
            const contactResult = await client.query(
              `
              INSERT INTO contacts (id, channel_id, external_id, display_name, profile)
              VALUES (gen_random_uuid(), $1, $2, $3, '{}'::jsonb)
              ON CONFLICT (channel_id, external_id)
              DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, contacts.display_name)
              RETURNING id, profile
              `,
              [channelId, senderWaId, profileName || 'User']
            );
            const contactRow = contactResult.rows[0];
            const contactId = contactRow.id;

            const existingProfile = contactRow.profile || {};
            if (existingProfile.blocked === true) {
              await client.query('ROLLBACK');
              client.release();
              continue;
            }

            // Check if this is the first message for this contact (Global check)
            const historyRes = await client.query(
              `SELECT 1 FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.contact_id = $1 LIMIT 1`,
              [contactId]
            );
            const isFirstMessage = (historyRes.rowCount === 0);

            // Find an open conversation for (channel, contact); else create one.
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

            // Map WhatsApp message type to our content_type.
            const type = msg.type; // 'text', 'image', 'audio', 'document', etc.
            let contentType = 'text';
            if (type === 'image') contentType = 'image';
            else if (type === 'audio') contentType = 'audio';
            else if (type === 'document') contentType = 'document';
            else if (type === 'video') contentType = 'video';
            else if (type === 'sticker') contentType = 'sticker';
            else if (type === 'location') contentType = 'location';
            else if (type === 'contacts') contentType = 'contact';
            else contentType = 'text';

            const externalMessageId = msg.id; // e.g., "wamid.XXXX"

            const rawMsg = { ...msg };
            if (translationMeta && translationMeta.languageCode && translationMeta.englishText) {
              rawMsg.translation = {
                languageCode: translationMeta.languageCode,
                englishText: translationMeta.englishText,
                originalText: textBody,
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

            // Insert message with idempotency: unique(channel_id, external_message_id)
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

            let messageId = null;
            if (messageResult.rowCount > 0) {
              messageId = messageResult.rows[0].id;
            }

            // Insert attachment if media present and message was newly recorded.
            const attachments = [];
            if (messageId) {
              if (type === 'image' && msg.image) {
                const attRes = await client.query(
                  `
                  INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
                  VALUES (gen_random_uuid(), $1, 'image', $2, $3, NOW())
                  RETURNING id, kind, url, mime_type
                  `,
                  [messageId, msg.image.id, msg.image.mime_type || null]
                );
                attachments.push(attRes.rows[0]);
              } else if (type === 'audio' && msg.audio) {
                const attRes = await client.query(
                  `
                  INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
                  VALUES (gen_random_uuid(), $1, 'audio', $2, $3, NOW())
                  RETURNING id, kind, url, mime_type
                  `,
                  [messageId, msg.audio.id, msg.audio.mime_type || null]
                );
                attachments.push(attRes.rows[0]);
              } else if (type === 'document' && msg.document) {
                const attRes = await client.query(
                  `
                  INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
                  VALUES (gen_random_uuid(), $1, 'document', $2, $3, NOW())
                  RETURNING id, kind, url, mime_type
                  `,
                  [messageId, msg.document.id, msg.document.mime_type || null]
                );
                attachments.push(attRes.rows[0]);
              } else if (type === 'video' && msg.video) {
                const attRes = await client.query(
                  `
                  INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
                  VALUES (gen_random_uuid(), $1, 'video', $2, $3, NOW())
                  RETURNING id, kind, url, mime_type
                  `,
                  [messageId, msg.video.id, msg.video.mime_type || null]
                );
                attachments.push(attRes.rows[0]);
              } else if (type === 'sticker' && msg.sticker) {
                const attRes = await client.query(
                  `
                  INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
                  VALUES (gen_random_uuid(), $1, 'sticker', $2, $3, NOW())
                  RETURNING id, kind, url, mime_type
                  `,
                  [messageId, msg.sticker.id, msg.sticker.mime_type || null]
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

            if (isFirstMessage) {
              try {
                // Trigger 'First Message' workflows
                await triggerWorkflowsForEvent('first_message', senderWaId, { conversationId, channelId });
                
                // Trigger 'Person Added' (new_contact) workflows as this is technically a new lead
                await triggerWorkflowsForEvent('new_contact', senderWaId, { 
                  name: profileName || 'User',
                  phone: senderWaId,
                  conversationId,
                  channelId 
                });
              } catch (e) {
                console.error('[WorkflowEvents] Failed to trigger first_message/new_contact workflows from webhook:', e);
              }
            }

            try {
              if (textBody) {
                await evaluateMessageRules(senderWaId, textBody, channelId);
                // Also trigger workflows for general incoming messages (Keywords)
                await triggerWorkflowsForEvent('incoming_whatsapp', senderWaId, { 
                  conversationId, 
                  channelId, 
                  text: textBody,
                  profileName
                });
              }
            } catch (e) {
              console.error('[Automation] Failed to evaluate rules or workflows from webhook:', e);
            }

            // Emit realtime event to notify agents.
            const io = getIO();
            if (io && messageId) {
              const payload = {
                conversationId,
                messageId,
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

            // --- AI Agent Integration ---
            // Trigger AI response if no workflows or rules handled it first
            // We run this asynchronously to not block the webhook response
            if (textBody && !isFirstMessage) {
              (async () => {
                 try {
                   // FAIL-SAFE: Check global AI config directly before calling AI service
                   const aiConfigCheck = await db.query('SELECT is_active FROM ai_agent_config LIMIT 1');
                   const isGlobalAiActive = aiConfigCheck.rows.length > 0 && aiConfigCheck.rows[0].is_active === true;
                   console.log(`[AI Agent Webhook] Global AI active check: ${isGlobalAiActive} (raw: ${JSON.stringify(aiConfigCheck.rows[0])})`);
                   
                   if (!isGlobalAiActive) {
                     console.log(`[AI Agent Webhook] AI is globally INACTIVE. Skipping auto-reply for conversation ${conversationId}.`);
                     return;
                   }

                   // Also check per-conversation AI toggle
                   const convAiCheck = await db.query('SELECT is_ai_active FROM conversations WHERE id = $1', [conversationId]);
                   const isConvAiActive = convAiCheck.rows.length > 0 && convAiCheck.rows[0].is_ai_active !== false;
                   console.log(`[AI Agent Webhook] Conversation ${conversationId} AI active: ${isConvAiActive}`);
                   
                   if (!isConvAiActive) {
                     console.log(`[AI Agent Webhook] AI is DISABLED for conversation ${conversationId}. Skipping.`);
                     return;
                   }

                   // Add a small delay to mimic typing and ensure DB is consistent
                   await new Promise(r => setTimeout(r, 1000));
                   
                   const aiResponse = await aiService.handleIncomingMessage(conversationId, textBody);
                   if (aiResponse) {
                      console.log(`[AI Agent] Generated response for ${conversationId}:`, aiResponse);
                      await outboundWhatsApp.sendText(conversationId, aiResponse);
                   }
                 } catch (aiErr) {
                    console.error('[AI Agent] Failed to generate/send response:', aiErr);
                 }
              })();
            }
            // ----------------------------


          } catch (err) {
            // On any error, rollback so the transaction does not leave partial state.
            try {
              await client.query('ROLLBACK');
            } catch (_) {
              // swallow rollback errors
            }
            client.release();
            // Bubble up: returning 500 allows Meta to retry later.
            throw err;
          }
        }
      }
    }

    // If we reached here, all processed messages succeeded or were duplicates (ignored).
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    // Central error path: fail the entire request so Meta retries.
    // Ensure we do not leak sensitive payload data in logs.
    err.status = 500;
    err.expose = false;
    return next(err);
  }
});

module.exports = router;
