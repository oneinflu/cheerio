'use strict';
/**
 * src/services/outboundInstagram.js
 *
 * Purpose:
 * - Orchestrates outbound Instagram messaging (send text DMs, media DMs).
 * - Uses the Instagram Graph API (Send API) to send messages.
 * - Persists message records and emits realtime events.
 *
 * Instagram Send API docs:
 * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
 */

const axios = require('axios');
const db = require('../../db');
const { getIO } = require('../realtime/io');

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Get conversation details along with Instagram-specific info
 */
async function getConversationDetails(clientConn, conversationId) {
  const res = await clientConn.query(
    `
    SELECT c.id, c.channel_id, c.contact_id, 
           ch.external_id AS ig_user_id, ch.type AS channel_type, ch.config AS channel_config
    FROM conversations c
    JOIN channels ch ON ch.id = c.channel_id
    WHERE c.id = $1
    `,
    [conversationId]
  );
  if (res.rowCount === 0) {
    const err = new Error('Conversation not found');
    err.status = 404;
    err.expose = true;
    throw err;
  }
  const row = res.rows[0];

  // Ensure it's an Instagram conversation
  if (row.channel_type !== 'instagram') {
    const err = new Error('This conversation is not an Instagram channel');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  const contactRes = await clientConn.query(
    `SELECT external_id FROM contacts WHERE id = $1`,
    [row.contact_id]
  );
  if (contactRes.rowCount === 0) {
    const err = new Error('Contact not found for conversation');
    err.status = 404;
    err.expose = true;
    throw err;
  }

  const recipientId = contactRes.rows[0].external_id;
  const config = row.channel_config || {};
  const accessToken = config.accessToken || config.page_token || process.env.WHATSAPP_TOKEN;

  if (!accessToken) {
    const err = new Error('No access token found for Instagram channel. Please reconnect Instagram.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  return {
    conversationId: row.id,
    channelId: row.channel_id,
    igUserId: row.ig_user_id,
    recipientId,
    accessToken,
  };
}

/**
 * Insert outbound message into DB
 */
async function insertOutboundMessage(clientConn, conversationId, channelId, contentType, textBody, rawPayload) {
  const res = await clientConn.query(
    `
    INSERT INTO messages (
      id, conversation_id, channel_id, direction, content_type,
      external_message_id, text_body, delivery_status, author_user_id,
      raw_payload, is_deleted, created_at, sent_at
    )
    VALUES (
      gen_random_uuid(), $1, $2, 'outbound', $3,
      NULL, $4, 'sending', NULL,
      $5::jsonb, FALSE, NOW(), NULL
    )
    RETURNING id
    `,
    [conversationId, channelId, contentType, textBody || null, JSON.stringify(rawPayload || {})]
  );
  return res.rows[0].id;
}

/**
 * Finalize outbound message status
 */
async function finalizeOutboundMessage(clientConn, messageId, conversationId, externalMessageId, success) {
  if (success) {
    await clientConn.query(
      `UPDATE messages SET external_message_id = $1, delivery_status = 'accepted', sent_at = NOW() WHERE id = $2`,
      [externalMessageId, messageId]
    );
  } else {
    await clientConn.query(
      `UPDATE messages SET delivery_status = 'failed' WHERE id = $1`,
      [messageId]
    );
  }
  await clientConn.query(
    `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );
}

/**
 * Emit realtime status event
 */
function emitStatus(conversationId, messageId, status, extra) {
  const io = getIO();
  if (!io) return;
  const payload = { conversationId, messageId, status, ...(extra || {}) };
  io.to(`conversation:${conversationId}`).emit('message:status', payload);
  io.emit('message:status', payload);
}

/**
 * Emit new message event
 */
function emitMessage(conversationId, messageId, contentType, textBody, rawPayload, attachments) {
  const io = getIO();
  if (!io) return;
  const payload = {
    conversationId, messageId, contentType, textBody,
    direction: 'outbound', rawPayload, attachments: attachments || [],
  };
  io.to(`conversation:${conversationId}`).emit('message:new', payload);
  io.emit('message:new', payload);
}

/**
 * Send a text DM via Instagram Graph API
 * 
 * POST /{ig-user-id}/messages
 * Body: { recipient: { id: "<IGSID>" }, message: { text: "hello" } }
 */
async function sendText(conversationId, text) {
  const clientConn = await db.getClient();
  try {
    await clientConn.query('BEGIN');
    const details = await getConversationDetails(clientConn, conversationId);

    const messageId = await insertOutboundMessage(
      clientConn, details.conversationId, details.channelId,
      'text', text, { type: 'text', text }
    );
    emitMessage(details.conversationId, messageId, 'text', text, { type: 'text', text });
    emitStatus(details.conversationId, messageId, 'sending');

    let resp;
    try {
      resp = await axios.post(
        `${GRAPH_BASE}/${details.igUserId}/messages`,
        {
          recipient: { id: details.recipientId },
          message: { text }
        },
        {
          params: { access_token: details.accessToken },
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (apiErr) {
      console.error('[Instagram sendText] API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, details.conversationId, null, false);
      await clientConn.query('COMMIT');
      emitStatus(details.conversationId, messageId, 'failed');
      const status = Number(apiErr.response?.status) || 500;
      const e = new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send Instagram DM');
      e.status = status;
      e.expose = status < 500;
      throw e;
    }

    const externalId = resp.data?.message_id || null;

    await clientConn.query(
      `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (gen_random_uuid(), NULL, 'message.send.instagram_text', 'conversation', $1, $2::jsonb, NOW())`,
      [details.conversationId, JSON.stringify({ messageId, externalMessageId: externalId })]
    );

    await finalizeOutboundMessage(clientConn, messageId, details.conversationId, externalId, true);
    await clientConn.query('COMMIT');
    emitStatus(details.conversationId, messageId, 'accepted', { externalMessageId: externalId });
    return { conversationId: details.conversationId, messageId, externalMessageId: externalId };
  } catch (err) {
    try { await clientConn.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    clientConn.release();
  }
}

/**
 * Send a media DM (image) via Instagram Graph API
 * 
 * POST /{ig-user-id}/messages
 * Body: { recipient: { id: "<IGSID>" }, message: { attachment: { type: "image", payload: { url: "..." } } } }
 */
async function sendMedia(conversationId, kind, url, caption) {
  const clientConn = await db.getClient();
  try {
    await clientConn.query('BEGIN');
    const details = await getConversationDetails(clientConn, conversationId);

    const messageId = await insertOutboundMessage(
      clientConn, details.conversationId, details.channelId,
      kind, caption || null, { type: 'media', kind, url, caption }
    );

    // Create attachment record
    const attRes = await clientConn.query(
      `INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NULL, NOW())
       RETURNING id, kind, url, mime_type`,
      [messageId, kind, url]
    );
    const attachment = attRes.rows[0];

    emitMessage(details.conversationId, messageId, kind, caption || null, null, [attachment]);
    emitStatus(details.conversationId, messageId, 'sending');

    // Instagram supports image, video, audio, file attachments
    const attachmentType = kind === 'document' ? 'file' : kind;

    let resp;
    try {
      resp = await axios.post(
        `${GRAPH_BASE}/${details.igUserId}/messages`,
        {
          recipient: { id: details.recipientId },
          message: {
            attachment: {
              type: attachmentType,
              payload: { url }
            }
          }
        },
        {
          params: { access_token: details.accessToken },
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (apiErr) {
      console.error('[Instagram sendMedia] API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, details.conversationId, null, false);
      await clientConn.query('COMMIT');
      emitStatus(details.conversationId, messageId, 'failed');
      const status = Number(apiErr.response?.status) || 500;
      const e = new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send Instagram media');
      e.status = status;
      e.expose = status < 500;
      throw e;
    }

    const externalId = resp.data?.message_id || null;

    await clientConn.query(
      `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (gen_random_uuid(), NULL, 'message.send.instagram_media', 'conversation', $1, $2::jsonb, NOW())`,
      [details.conversationId, JSON.stringify({ messageId, externalMessageId: externalId, kind, url })]
    );

    await finalizeOutboundMessage(clientConn, messageId, details.conversationId, externalId, true);
    await clientConn.query('COMMIT');
    emitStatus(details.conversationId, messageId, 'accepted', { externalMessageId: externalId });
    return { conversationId: details.conversationId, messageId, externalMessageId: externalId };
  } catch (err) {
    try { await clientConn.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    clientConn.release();
  }
}

/**
 * Send a DM to an Instagram user by their IGSID (for auto-DM / comment-to-DM)
 * This creates a new conversation if one doesn't exist.
 */
async function sendAutoDM(channelId, recipientIGSID, text) {
  const clientConn = await db.getClient();
  try {
    await clientConn.query('BEGIN');

    // Get channel info
    const channelRes = await clientConn.query(
      `SELECT id, external_id, config FROM channels WHERE id = $1 AND type = 'instagram'`,
      [channelId]
    );
    if (channelRes.rowCount === 0) {
      throw new Error('Instagram channel not found');
    }
    const channel = channelRes.rows[0];
    const accessToken = channel.config?.accessToken || channel.config?.page_token || process.env.WHATSAPP_TOKEN;

    // Upsert contact
    const contactRes = await clientConn.query(
      `INSERT INTO contacts (channel_id, external_id, display_name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (channel_id, external_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [channelId, recipientIGSID, `Instagram User ${recipientIGSID}`]
    );
    const contactId = contactRes.rows[0].id;

    // Find or create conversation
    let convRes = await clientConn.query(
      `SELECT id FROM conversations WHERE channel_id = $1 AND contact_id = $2 AND status != 'closed'
       ORDER BY created_at DESC LIMIT 1`,
      [channelId, contactId]
    );

    let conversationId;
    if (convRes.rows.length > 0) {
      conversationId = convRes.rows[0].id;
    } else {
      const newConv = await clientConn.query(
        `INSERT INTO conversations (channel_id, contact_id, status, last_message_at)
         VALUES ($1, $2, 'open', NOW()) RETURNING id`,
        [channelId, contactId]
      );
      conversationId = newConv.rows[0].id;
    }

    // Insert message record
    const messageId = await insertOutboundMessage(
      clientConn, conversationId, channelId,
      'text', text, { type: 'text', text, source: 'auto_dm' }
    );

    // Send via Instagram API
    let resp;
    try {
      resp = await axios.post(
        `${GRAPH_BASE}/${channel.external_id}/messages`,
        {
          recipient: { id: recipientIGSID },
          message: { text }
        },
        {
          params: { access_token: accessToken },
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (apiErr) {
      console.error('[Instagram autoDM] API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, conversationId, null, false);
      await clientConn.query('COMMIT');
      return { success: false, error: apiErr.response?.data?.error?.message || apiErr.message };
    }

    const externalId = resp.data?.message_id || null;
    await finalizeOutboundMessage(clientConn, messageId, conversationId, externalId, true);
    await clientConn.query('COMMIT');

    emitMessage(conversationId, messageId, 'text', text, { type: 'text', text, source: 'auto_dm' });

    return { success: true, conversationId, messageId, externalMessageId: externalId };
  } catch (err) {
    try { await clientConn.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    clientConn.release();
  }
}

module.exports = {
  sendText,
  sendMedia,
  sendAutoDM,
};
