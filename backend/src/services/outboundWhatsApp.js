'use strict';
/**
 * src/services/outboundWhatsApp.js
 *
 * Purpose:
 * - Orchestrates outbound WhatsApp messaging (text, media, template).
 * - Enforces the 24-hour customer service window for non-template messages.
 * - Persists message records and statuses, ensures consistent state with transactions.
 * - Emits realtime events for UI updates.
 *
 * Algorithm:
 * 1) Lookup conversation (ensure it exists), fetch channel and contact details.
 * 2) Check 24-hour rule:
 *    - Find the most recent inbound message timestamp.
 *    - If older than 24 hours, only templates are allowed; otherwise reject.
 * 3) Create a message row with status 'sending' (or 'queued', then 'sending').
 * 4) Call WhatsApp Cloud API (text/media/template) with official endpoints.
 * 5) Update DB with external_message_id and status ('sent' or 'failed').
 * 6) Update conversation.last_message_at and emit realtime events.
 *
 * Notes:
 * - Idempotency for outbound is handled by linking external_message_id when available.
 * - For robustness, consider client-provided idempotency keys to avoid duplicate sends.
 */

const db = require('../../db');
const { getIO } = require('../realtime/io');
const client = require('../integrations/meta/whatsappClient');

const H24_MS = 24 * 60 * 60 * 1000;

async function getConversationDetails(clientConn, conversationId) {
  const res = await clientConn.query(
    `
    SELECT c.id, c.channel_id, c.contact_id, ch.external_id AS phone_number_id
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
  return {
    conversationId: row.id,
    channelId: row.channel_id,
    phoneNumberId: row.phone_number_id,
    toWaId: contactRes.rows[0].external_id,
  };
}

async function enforce24hWindow(clientConn, conversationId, isTemplate) {
  if (isTemplate) return; // Templates allowed anytime by policy
  const res = await clientConn.query(
    `
    SELECT created_at
    FROM messages
    WHERE conversation_id = $1 AND direction = 'inbound'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [conversationId]
  );
  if (res.rowCount === 0) {
    const err = new Error('No inbound history; only template messages allowed');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  const lastInboundAt = new Date(res.rows[0].created_at).getTime();
  const now = Date.now();
  if (now - lastInboundAt > H24_MS) {
    const err = new Error('24-hour window expired; send a template message');
    err.status = 400;
    err.expose = true;
    throw err;
  }
}

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

async function finalizeOutboundMessage(clientConn, messageId, conversationId, externalMessageId, success) {
  if (success) {
    await clientConn.query(
      `
      UPDATE messages
      SET external_message_id = $1, delivery_status = 'sent', sent_at = NOW()
      WHERE id = $2
      `,
      [externalMessageId, messageId]
    );
  } else {
    await clientConn.query(
      `
      UPDATE messages
      SET delivery_status = 'failed'
      WHERE id = $1
      `,
      [messageId]
    );
  }
  await clientConn.query(
    `
    UPDATE conversations
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = $1
    `,
    [conversationId]
  );
}

function emitStatus(conversationId, messageId, status, extra) {
  const io = getIO();
  if (!io) return;
  const payload = {
    conversationId,
    messageId,
    status,
    ...(extra || {}),
  };
  io.to(`conversation:${conversationId}`).emit('message:status', payload);
  io.emit('message:status', payload);
}

function emitMessage(conversationId, messageId, contentType, textBody, rawPayload, attachments) {
  const io = getIO();
  if (!io) return;
  
  const payload = {
    conversationId,
    messageId,
    contentType,
    textBody,
    direction: 'outbound',
    rawPayload,
    attachments: attachments || [],
  };
  io.to(`conversation:${conversationId}`).emit('message:new', payload);
  io.emit('message:new', payload);
}

async function sendText(conversationId, text) {
  const clientConn = await db.getClient();
  try {
    await clientConn.query('BEGIN');
    const details = await getConversationDetails(clientConn, conversationId);
    await enforce24hWindow(clientConn, conversationId, false);

    const messageId = await insertOutboundMessage(
      clientConn,
      details.conversationId,
      details.channelId,
      'text',
      text,
      { type: 'text', text }
    );
    emitMessage(details.conversationId, messageId, 'text', text);
    emitStatus(details.conversationId, messageId, 'sending');

    let resp;
    try {
      resp = await client.sendText(details.phoneNumberId, details.toWaId, text);
    } catch (apiErr) {
      console.error('[sendText] Meta API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, details.conversationId, null, false);
      await clientConn.query('COMMIT');
      emitStatus(details.conversationId, messageId, 'failed');
      throw new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send text');
    }

    const externalId =
      resp.data && Array.isArray(resp.data.messages) && resp.data.messages[0]
        ? resp.data.messages[0].id
        : null;

    await clientConn.query(
      `
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (gen_random_uuid(), NULL, 'message.send.text', 'conversation', $1, $2::jsonb, NOW())
      `,
      [details.conversationId, JSON.stringify({ messageId, externalMessageId: externalId })]
    );

    await finalizeOutboundMessage(clientConn, messageId, details.conversationId, externalId, true);
    await clientConn.query('COMMIT');
    emitStatus(details.conversationId, messageId, 'sent', { externalMessageId: externalId });
    return { conversationId: details.conversationId, messageId, externalMessageId: externalId };
  } catch (err) {
    try {
      await clientConn.query('ROLLBACK');
    } catch (_) {}
    throw err;
  } finally {
    clientConn.release();
  }
}

async function sendMedia(conversationId, kind, link, caption) {
  const clientConn = await db.getClient();
  try {
    await clientConn.query('BEGIN');
    const details = await getConversationDetails(clientConn, conversationId);
    await enforce24hWindow(clientConn, conversationId, false);

    const messageId = await insertOutboundMessage(
      clientConn,
      details.conversationId,
      details.channelId,
      kind,
      caption || null,
      { type: 'media', kind, link, caption }
    );

    // Attachments record referencing the sent media link.
    const attRes = await clientConn.query(
      `
      INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NULL, NOW())
      RETURNING id, kind, url, mime_type
      `,
      [messageId, kind, link]
    );
    const attachment = attRes.rows[0];

    emitMessage(details.conversationId, messageId, kind, caption || null, null, [attachment]);
    emitStatus(details.conversationId, messageId, 'sending');

    let resp;
    try {
      resp = await client.sendMedia(details.phoneNumberId, details.toWaId, kind, link, caption);
    } catch (apiErr) {
      console.error('[sendMedia] Meta API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, details.conversationId, null, false);
      await clientConn.query('COMMIT');
      emitStatus(details.conversationId, messageId, 'failed');
      throw new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send media');
    }

    const externalId =
      resp.data && Array.isArray(resp.data.messages) && resp.data.messages[0]
        ? resp.data.messages[0].id
        : null;

    await clientConn.query(
      `
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (gen_random_uuid(), NULL, 'message.send.media', 'conversation', $1, $2::jsonb, NOW())
      `,
      [details.conversationId, JSON.stringify({ messageId, externalMessageId: externalId, kind, link })]
    );

    await finalizeOutboundMessage(clientConn, messageId, details.conversationId, externalId, true);
    await clientConn.query('COMMIT');
    emitStatus(details.conversationId, messageId, 'sent', { externalMessageId: externalId });
    return { conversationId: details.conversationId, messageId, externalMessageId: externalId };
  } catch (err) {
    try {
      await clientConn.query('ROLLBACK');
    } catch (_) {}
    throw err;
  } finally {
    clientConn.release();
  }
}

async function sendTemplate(conversationId, name, languageCode, components) {
  const clientConn = await db.getClient();
  try {
    await clientConn.query('BEGIN');
    const details = await getConversationDetails(clientConn, conversationId);
    // Template messages are allowed regardless of 24h window.

    const rawPayload = { type: 'template', name, languageCode, components };
    const messageId = await insertOutboundMessage(
      clientConn,
      details.conversationId,
      details.channelId,
      'text',
      `Template: ${name}`,
      rawPayload
    );
    emitMessage(details.conversationId, messageId, 'text', `Template: ${name}`, rawPayload);
    emitStatus(details.conversationId, messageId, 'sending');

    let resp;
    try {
      resp = await client.sendTemplate(
        details.phoneNumberId,
        details.toWaId,
        name,
        languageCode,
        components
      );
    } catch (apiErr) {
      console.error('[sendTemplate] Meta API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, details.conversationId, null, false);
      await clientConn.query('COMMIT');
      emitStatus(details.conversationId, messageId, 'failed');
      throw new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send template');
    }

    const externalId =
      resp.data && Array.isArray(resp.data.messages) && resp.data.messages[0]
        ? resp.data.messages[0].id
        : null;

    await clientConn.query(
      `
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (gen_random_uuid(), NULL, 'message.send.template', 'conversation', $1, $2::jsonb, NOW())
      `,
      [details.conversationId, JSON.stringify({ messageId, externalMessageId: externalId, name, languageCode })]
    );

    await finalizeOutboundMessage(clientConn, messageId, details.conversationId, externalId, true);
    await clientConn.query('COMMIT');
    emitStatus(details.conversationId, messageId, 'sent', { externalMessageId: externalId });
    return { conversationId: details.conversationId, messageId, externalMessageId: externalId };
  } catch (err) {
    try {
      await clientConn.query('ROLLBACK');
    } catch (_) {}
    throw err;
  } finally {
    clientConn.release();
  }
}

async function sendTypingIndicator(conversationId, action) {
  const clientConn = await db.getClient();
  try {
    const details = await getConversationDetails(clientConn, conversationId);
    // Best effort, no db persistence or 24h check needed for typing indicators
    await client.sendSenderAction(details.phoneNumberId, details.toWaId, action);
  } catch (err) {
    // silently fail for typing indicators
    console.warn(`[sendTypingIndicator] failed for conv=${conversationId}`, err.message);
  } finally {
    clientConn.release();
  }
}

async function uploadMedia(conversationId, fileBuffer, mimeType, filename) {
  const clientConn = await db.getClient();
  try {
    const details = await getConversationDetails(clientConn, conversationId);
    // 24h check technically not needed for upload, but good to check if we can even message this person?
    // Actually upload is just stashing media. We check 24h when sending.
    
    const result = await client.uploadMedia(details.phoneNumberId, fileBuffer, mimeType, filename);
    return result; // { id: '...' }
  } finally {
    clientConn.release();
  }
}

module.exports = {
  sendText,
  sendMedia,
  sendTemplate,
  sendTypingIndicator,
  uploadMedia,
};
