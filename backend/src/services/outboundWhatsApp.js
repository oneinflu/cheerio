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
const cloudinaryLib = require('cloudinary').v2;
const translation = require('./translation');
const waConfig = require('../utils/whatsappConfig');

const H24_MS = 24 * 60 * 60 * 1000;

const HAS_CLOUDINARY =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (HAS_CLOUDINARY) {
  cloudinaryLib.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

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
  const toWaId = String(contactRow.external_id || '').replace(/[^0-9]/g, '');
  if (!toWaId) {
    const err = new Error('Invalid WhatsApp recipient number for conversation');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  return {
    conversationId: row.id,
    channelId: row.channel_id,
    phoneNumberId: row.phone_number_id,
    toWaId,
    contactProfile: contactRow.profile || {},
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
    const err = new Error("No customer message history found. Meta policy requires a 'Send Template' node for the first outreach to a new lead. 'Response Message' nodes only work for active conversations (replies).");
    err.status = 400;
    err.expose = true;
    throw err;
  }
  const lastInboundAt = new Date(res.rows[0].created_at).getTime();
  const now = Date.now();
  if (now - lastInboundAt > H24_MS) {
    const err = new Error("24-hour service window is closed. Meta policy requires a Template for outbound messages until the user replies. Please use a 'Send Template' node with buttons instead of 'Response Message' for cold outreach.");
    err.status = 400;
    err.expose = true;
    throw err;
  }
}

async function insertOutboundMessage(clientConn, conversationId, channelId, contentType, textBody, rawPayload, templateName = null) {
  const res = await clientConn.query(
    `
    INSERT INTO messages (
      id, conversation_id, channel_id, direction, content_type,
      external_message_id, text_body, delivery_status, author_user_id,
      raw_payload, is_deleted, created_at, sent_at, template_name
    )
    VALUES (
      gen_random_uuid(), $1, $2, 'outbound', $3,
      NULL, $4, 'sending', NULL,
      $5::jsonb, FALSE, NOW(), NULL, $6
    )
    RETURNING id
    `,
    [conversationId, channelId, contentType, textBody || null, JSON.stringify(rawPayload || {}), templateName]
  );
  return res.rows[0].id;
}

async function finalizeOutboundMessage(clientConn, messageId, conversationId, externalMessageId, success) {
  if (success) {
    await clientConn.query(
      `
      UPDATE messages
      SET external_message_id = $1, delivery_status = 'accepted', sent_at = NOW()
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
    const isBlocked =
      details.contactProfile &&
      details.contactProfile.blocked === true;
    if (isBlocked) {
      const err = new Error('This number is blocked. Unblock to send messages.');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    await enforce24hWindow(clientConn, conversationId, false);

    const preferredLang =
      details.contactProfile &&
      typeof details.contactProfile.preferred_language === 'string' &&
      details.contactProfile.preferred_language
        ? details.contactProfile.preferred_language
        : null;

    let textForMeta = text;
    let translatedText = null;

    if (preferredLang && preferredLang !== 'en') {
      try {
        const t = await translation.translateFromEnglish(text, preferredLang);
        if (t && typeof t === 'string') {
          textForMeta = t;
          translatedText = t;
        }
      } catch (_) {
        textForMeta = text;
      }
    }

    const messageId = await insertOutboundMessage(
      clientConn,
      details.conversationId,
      details.channelId,
      'text',
      text,
      {
        type: 'text',
        text,
        translatedText: translatedText || null,
        targetLanguage: preferredLang || null,
      }
    );
    emitMessage(details.conversationId, messageId, 'text', text, {
      type: 'text',
      text,
      translatedText: translatedText || null,
      targetLanguage: preferredLang || null,
    });
    emitStatus(details.conversationId, messageId, 'sending');
    const customConfig = await waConfig.getConfigByPhone(details.phoneNumberId);

    let resp;
    try {
      resp = await client.sendText(details.phoneNumberId, details.toWaId, textForMeta, customConfig);
    } catch (apiErr) {
      console.error('[sendText] Meta API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, details.conversationId, null, false);
      await clientConn.query('COMMIT');
      emitStatus(details.conversationId, messageId, 'failed');
      const status = Number(apiErr.status || apiErr.response?.status) || 500;
      const e = new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send text');
      e.status = status;
      e.expose = status < 500;
      throw e;
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
    emitStatus(details.conversationId, messageId, 'accepted', { externalMessageId: externalId });
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
    const isBlocked =
      details.contactProfile &&
      details.contactProfile.blocked === true;
    if (isBlocked) {
      const err = new Error('This number is blocked. Unblock to send messages.');
      err.status = 400;
      err.expose = true;
      throw err;
    }
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
    const customConfig = await waConfig.getConfigByPhone(details.phoneNumberId);

    let resp;
    try {
      resp = await client.sendMedia(details.phoneNumberId, details.toWaId, kind, link, caption, customConfig);
    } catch (apiErr) {
      console.error('[sendMedia] Meta API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, details.conversationId, null, false);
      await clientConn.query('COMMIT');
      emitStatus(details.conversationId, messageId, 'failed');
      const status = Number(apiErr.status || apiErr.response?.status) || 500;
      const e = new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send media');
      e.status = status;
      e.expose = status < 500;
      throw e;
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
    emitStatus(details.conversationId, messageId, 'accepted', { externalMessageId: externalId });
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
    const isBlocked =
      details.contactProfile &&
      details.contactProfile.blocked === true;
    if (isBlocked) {
      const err = new Error('This number is blocked. Unblock to send messages.');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    // Template messages are allowed regardless of 24h window.

    const rawPayload = { type: 'template', name, languageCode, components };
    const messageId = await insertOutboundMessage(
      clientConn,
      details.conversationId,
      details.channelId,
      'template',
      `Template: ${name}`,
      rawPayload,
      name
    );
    emitMessage(details.conversationId, messageId, 'text', `Template: ${name}`, rawPayload);
    emitStatus(details.conversationId, messageId, 'sending');
    const customConfig = await waConfig.getConfigByPhone(details.phoneNumberId);

    let resp;
    try {
      resp = await client.sendTemplate(
        details.phoneNumberId,
        details.toWaId,
        name,
        languageCode,
        components,
        customConfig
      );
    } catch (apiErr) {
      console.error('[sendTemplate] Meta API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, details.conversationId, null, false);
      await clientConn.query('COMMIT');
      emitStatus(details.conversationId, messageId, 'failed');
      const status = Number(apiErr.status || apiErr.response?.status) || 500;
      const e = new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send template');
      e.status = status;
      e.expose = status < 500;
      throw e;
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
    emitStatus(details.conversationId, messageId, 'accepted', { externalMessageId: externalId });
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

async function sendInteractive(conversationId, interactive) {
  const clientConn = await db.getClient();
  try {
    await clientConn.query('BEGIN');
    const details = await getConversationDetails(clientConn, conversationId);
    const isBlocked =
      details.contactProfile &&
      details.contactProfile.blocked === true;
    if (isBlocked) {
      const err = new Error('This number is blocked. Unblock to send messages.');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    
    await enforce24hWindow(clientConn, conversationId, false);

    // Validate/Update Flow Message Version
    if (interactive.type === 'flow' && interactive.action && interactive.action.parameters) {
       interactive.action.parameters.flow_message_version = '3';
    }

    const messageId = await insertOutboundMessage(
      clientConn,
      details.conversationId,
      details.channelId,
      'interactive',
      interactive.body?.text || 'Interactive Message',
      { type: 'interactive', interactive }
    );
    
    emitMessage(details.conversationId, messageId, 'interactive', interactive.body?.text || 'Interactive Message', { type: 'interactive', interactive });
    emitStatus(details.conversationId, messageId, 'sending');
    const customConfig = await waConfig.getConfigByPhone(details.phoneNumberId); // Added config lookup

    let resp;
    try {
      resp = await client.sendInteractiveMessage(details.phoneNumberId, details.toWaId, interactive, customConfig); // Passed customConfig
    } catch (apiErr) {
      console.error('[sendInteractive] Meta API failed:', apiErr.response?.data || apiErr.message);
      await finalizeOutboundMessage(clientConn, messageId, details.conversationId, null, false);
      await clientConn.query('COMMIT');
      emitStatus(details.conversationId, messageId, 'failed');
      const status = Number(apiErr.status || apiErr.response?.status) || 500;
      const e = new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send interactive message');
      e.status = status;
      e.expose = status < 500;
      throw e;
    }

    const externalId =
      resp.data && Array.isArray(resp.data.messages) && resp.data.messages[0]
        ? resp.data.messages[0].id
        : null;

    await clientConn.query(
      `
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (gen_random_uuid(), NULL, 'message.send.interactive', 'conversation', $1, $2::jsonb, NOW())
      `,
      [details.conversationId, JSON.stringify({ messageId, externalMessageId: externalId, interactive })]
    );

    await finalizeOutboundMessage(clientConn, messageId, details.conversationId, externalId, true);
    await clientConn.query('COMMIT');
    emitStatus(details.conversationId, messageId, 'accepted', { externalMessageId: externalId });
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
  const enabled = String(process.env.WHATSAPP_ENABLE_TYPING_INDICATOR || '').toLowerCase() === 'true';
  if (!enabled) return;
  const clientConn = await db.getClient();
  try {
    const details = await getConversationDetails(clientConn, conversationId);
    const customConfig = await waConfig.getConfigByPhone(details.phoneNumberId);
    await client.sendSenderAction(details.phoneNumberId, details.toWaId, action, customConfig);
  } catch (err) {
    console.warn(`[sendTypingIndicator] failed for conv=${conversationId}`, err.message);
  } finally {
    clientConn.release();
  }
}

async function uploadMedia(conversationId, fileBuffer, mimeType, filename) {
  const clientConn = await db.getClient();
  try {
    const details = await getConversationDetails(clientConn, conversationId);

    if (HAS_CLOUDINARY) {
      let cloudResult = null;
      try {
        const base64 = fileBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;
        cloudResult = await cloudinaryLib.uploader.upload(dataUri, {
          resource_type: 'auto',
          folder: process.env.CLOUDINARY_FOLDER || 'whatsapp_media',
          use_filename: true,
          unique_filename: true,
        });
      } catch (cloudErr) {
        console.error('[uploadMedia] Cloudinary upload failed:', cloudErr.message);
      }

      if (cloudResult && cloudResult.secure_url) {
        const kind =
          mimeType && mimeType.startsWith('image/')
            ? 'image'
            : mimeType && mimeType.startsWith('video/')
            ? 'video'
            : mimeType && mimeType.startsWith('audio/')
            ? 'audio'
            : 'document';

        try {
          await clientConn.query(
            `
            INSERT INTO media_assets (
              id,
              kind,
              cloudinary_public_id,
              url,
              mime_type,
              original_filename,
              conversation_id,
              created_at
            )
            VALUES (
              gen_random_uuid(),
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              NOW()
            )
            `,
            [
              kind,
              cloudResult.public_id,
              cloudResult.secure_url,
              mimeType || null,
              filename || null,
              conversationId,
            ]
          );
        } catch (dbErr) {
          console.error('[uploadMedia] Failed to persist media_assets row:', dbErr.message);
        }

        return {
          id: cloudResult.secure_url,
          url: cloudResult.secure_url,
          cloudinary_public_id: cloudResult.public_id,
          kind,
          mime_type: mimeType || null,
        };
      }
    }

    const customConfig = await waConfig.getConfigByPhone(details.phoneNumberId);
    const result = await client.uploadMedia(details.phoneNumberId, fileBuffer, mimeType, filename, customConfig);
    return result;
  } finally {
    clientConn.release();
  }
}

async function sendMessage(conversationId, text, buttons, headerType, headerUrl) {
  const safeText = (text || '').trim();
  if (buttons && buttons.length > 0 && safeText.length > 0) {
    const interactive = {
      type: 'button',
      body: { text: safeText },
      action: {
        buttons: buttons
          .map(b => b.reply ? b : { type: 'reply', reply: { id: b, title: b } })
          .filter(b => b.reply?.title && b.reply.title.trim().length > 0)
          .slice(0, 3) // Max 3 buttons for WhatsApp interactive
      }
    };
    if (headerType && headerType !== 'none' && headerUrl) {
       interactive.header = { type: headerType, [headerType]: { link: headerUrl } };
    }
    return sendInteractive(conversationId, interactive);
  } else if (safeText.length > 0) {
    return sendText(conversationId, safeText);
  }
}

async function sendListMenu(conversationId, bodyText, buttonText, sections, headerText, footerText) {
  const interactive = {
    type: 'list',
    body: { text: bodyText },
    action: {
      button: (buttonText || 'Select Option').slice(0, 20),
      sections: sections.map(sec => ({
        ...sec,
        rows: (sec.rows || []).map(r => ({
          ...r,
          id: String(r.id || r.title).slice(0, 200),
          title: String(r.title || 'Option').slice(0, 24),
          description: r.description ? String(r.description).slice(0, 72) : undefined
        })).slice(0, 10)
      })).slice(0, 10)
    }
  };
  if (headerText) {
    interactive.header = { type: 'text', text: headerText.slice(0, 60) };
  }
  if (footerText) {
    interactive.footer = { text: footerText.slice(0, 60) };
  }
  return sendInteractive(conversationId, interactive);
}

module.exports = {
  sendMessage,
  sendText,
  sendMedia,
  sendTemplate,
  sendInteractive,
  sendListMenu,
  sendTypingIndicator,
  uploadMedia,
};
