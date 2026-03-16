'use strict';
/**
 * src/services/outboundTelegram.js
 *
 * Purpose:
 * - Orchestrates outbound Telegram messaging (text, media).
 * - Persists message records and statuses.
 * - Emits realtime events for UI updates.
 */

const db = require('../../db');
const { getIO } = require('../realtime/io');
const telegramClient = require('../integrations/telegram/telegramClient');
const translation = require('./translation');

/**
 * Get conversation details
 */
async function getConversationDetails(clientConn, conversationId) {
  const res = await clientConn.query(
    `
    SELECT c.id, c.channel_id, c.contact_id, ch.external_id AS bot_token
    FROM conversations c
    JOIN channels ch ON ch.id = c.channel_id
    WHERE c.id = $1 AND ch.type = 'telegram'
    `,
    [conversationId]
  );
  if (res.rowCount === 0) {
    const err = new Error('Telegram conversation not found');
    err.status = 404;
    err.expose = true;
    throw err;
  }
  const row = res.rows[0];
  const contactRes = await db.query(
    `SELECT external_id, profile FROM contacts WHERE id = $1`,
    [row.contact_id]
  );
  if (contactRes.rowCount === 0) {
    const err = new Error('Contact not found for conversation');
    err.status = 404;
    err.expose = true;
    throw err;
  }
  const contactRow = contactRes.rows[0];
  const chatId = String(contactRow.external_id);
  if (!chatId) {
    const err = new Error('Invalid Telegram chat ID');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  return {
    conversationId: row.id,
    channelId: row.channel_id,
    botToken: row.bot_token,
    chatId: chatId
  };
}

/**
 * Send text message
 */
async function sendText(conversationId, text) {
  const clientConn = await db.getClient();
  try {
    await clientConn.query('BEGIN');

    const details = await getConversationDetails(clientConn, conversationId);
    const { botToken, chatId } = details;

    // Translate if needed
    let translationMeta = null;
    try {
      translationMeta = await translation.detectAndTranslateToEnglish(text);
    } catch (e) {
      translationMeta = null;
    }

    // Create message record
    const messageResult = await clientConn.query(
      `
      INSERT INTO messages (
        id, conversation_id, channel_id, direction, content_type,
        text_body, delivery_status, author_user_id, raw_payload, created_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, 'outbound', 'text',
        $3, 'sending', NULL, $4::jsonb, NOW()
      )
      RETURNING id
      `,
      [
        details.conversationId,
        details.channelId,
        text,
        JSON.stringify({
          translation: translationMeta,
          type: 'text'
        })
      ]
    );

    const messageId = messageResult.rows[0].id;

    // Update conversation
    await clientConn.query(
      `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [details.conversationId]
    );

    await clientConn.query('COMMIT');
    clientConn.release();

    // Send via Telegram API
    try {
      const resp = await telegramClient.sendText(botToken, chatId, text);
      
      // Update message with sent status
      await db.query(
        `
        UPDATE messages
        SET delivery_status = 'sent', sent_at = NOW()
        WHERE id = $1
        `,
        [messageId]
      );

      // Emit realtime event
      const io = getIO();
      if (io) {
        io.to(`conversation:${details.conversationId}`).emit('message:status', {
          conversationId: details.conversationId,
          messageId,
          status: 'sent'
        });
      }

      return { success: true, messageId };
    } catch (apiErr) {
      // Update message with failed status
      await db.query(
        `
        UPDATE messages
        SET delivery_status = 'failed'
        WHERE id = $1
        `,
        [messageId]
      );

      throw apiErr;
    }
  } catch (err) {
    try {
      await clientConn.query('ROLLBACK');
    } catch (_) {}
    clientConn.release();
    throw err;
  }
}

/**
 * Send media message
 */
async function sendMedia(conversationId, mediaType, mediaUrl, caption = '') {
  const clientConn = await db.getClient();
  try {
    await clientConn.query('BEGIN');

    const details = await getConversationDetails(clientConn, conversationId);
    const { botToken, chatId } = details;

    // Create message record
    const messageResult = await clientConn.query(
      `
      INSERT INTO messages (
        id, conversation_id, channel_id, direction, content_type,
        text_body, delivery_status, author_user_id, raw_payload, created_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, 'outbound', $3,
        $4, 'sending', NULL, $5::jsonb, NOW()
      )
      RETURNING id
      `,
      [
        details.conversationId,
        details.channelId,
        mediaType,
        caption || `[${mediaType}]`,
        JSON.stringify({
          mediaUrl,
          mediaType,
          caption
        })
      ]
    );

    const messageId = messageResult.rows[0].id;

    // Update conversation
    await clientConn.query(
      `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [details.conversationId]
    );

    await clientConn.query('COMMIT');
    clientConn.release();

    // Send via Telegram API
    try {
      let resp;
      switch (mediaType) {
        case 'image':
          resp = await telegramClient.sendPhoto(botToken, chatId, mediaUrl, caption);
          break;
        case 'document':
          resp = await telegramClient.sendDocument(botToken, chatId, mediaUrl, caption);
          break;
        case 'audio':
          resp = await telegramClient.sendAudio(botToken, chatId, mediaUrl, caption);
          break;
        case 'video':
          resp = await telegramClient.sendVideo(botToken, chatId, mediaUrl, caption);
          break;
        default:
          throw new Error(`Unsupported media type: ${mediaType}`);
      }

      // Update message with sent status
      await db.query(
        `
        UPDATE messages
        SET delivery_status = 'sent', sent_at = NOW()
        WHERE id = $1
        `,
        [messageId]
      );

      // Emit realtime event
      const io = getIO();
      if (io) {
        io.to(`conversation:${details.conversationId}`).emit('message:status', {
          conversationId: details.conversationId,
          messageId,
          status: 'sent'
        });
      }

      return { success: true, messageId };
    } catch (apiErr) {
      // Update message with failed status
      await db.query(
        `
        UPDATE messages
        SET delivery_status = 'failed'
        WHERE id = $1
        `,
        [messageId]
      );

      throw apiErr;
    }
  } catch (err) {
    try {
      await clientConn.query('ROLLBACK');
    } catch (_) {}
    clientConn.release();
    throw err;
  }
}

/**
 * Send typing indicator
 */
async function sendTypingIndicator(conversationId, isTyping = true) {
  try {
    const details = await getConversationDetails(await db.getClient(), conversationId);
    const { botToken, chatId } = details;
    
    await telegramClient.sendChatAction(botToken, chatId, 'typing');
  } catch (err) {
    console.error('[Telegram] Failed to send typing indicator:', err.message);
  }
}

module.exports = {
  sendText,
  sendMedia,
  sendTypingIndicator,
  getConversationDetails
};
