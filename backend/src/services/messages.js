'use strict';
const db = require('../../db');
const translation = require('./translation');

async function listMessages(conversationId) {
  const msgs = await db.query(
    `
    SELECT id, conversation_id, direction, content_type, text_body, raw_payload, created_at, external_message_id
    FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC
    `,
    [conversationId]
  );
  const ids = msgs.rows.map((m) => m.id);
  let attachments = [];
  if (ids.length > 0) {
    const att = await db.query(
      `
      SELECT id, message_id, kind, url, mime_type
      FROM attachments
      WHERE message_id = ANY($1::uuid[])
      ORDER BY id ASC
      `,
      [ids]
    );
    attachments = att.rows;
  }
  const attByMsg = new Map();
  for (const a of attachments) {
    const arr = attByMsg.get(a.message_id) || [];
    arr.push(a);
    attByMsg.set(a.message_id, arr);
  }

  const needsTranslation = [];
  for (const m of msgs.rows) {
    if (m.direction !== 'inbound') continue;
    if (m.content_type !== 'text') continue;
    if (!m.text_body || !m.text_body.trim()) continue;
    const raw = m.raw_payload || {};
    if (raw.translation && raw.translation.englishText) continue;
    needsTranslation.push(m);
  }

  if (needsTranslation.length > 0 && translation && translation.detectAndTranslateToEnglish) {
    for (const m of needsTranslation) {
      try {
        const meta = await translation.detectAndTranslateToEnglish(m.text_body);
        if (!meta || !meta.languageCode || !meta.englishText) continue;
        const raw = m.raw_payload || {};
        raw.translation = {
          languageCode: meta.languageCode,
          englishText: meta.englishText,
          originalText: m.text_body,
        };
        m.raw_payload = raw;
        await db.query(
          `
          UPDATE messages
          SET raw_payload = $2::jsonb
          WHERE id = $1
          `,
          [m.id, JSON.stringify(raw)]
        );
      } catch (e) {
      }
    }
  }

  return msgs.rows.map((m) => {
    const raw = m.raw_payload || {};
    return {
      id: m.id,
      conversationId: m.conversation_id,
      direction: m.direction,
      contentType: m.content_type,
      textBody: m.text_body,
      rawPayload: raw,
      createdAt: m.created_at,
      externalMessageId: m.external_message_id,
      attachments: attByMsg.get(m.id) || [],
      translation: raw.translation || null,
    };
  });
}

async function markAsRead(conversationId) {
  await db.query(
    `UPDATE messages
     SET read_at = NOW()
     WHERE conversation_id = $1
       AND direction = 'inbound'
       AND read_at IS NULL`,
    [conversationId]
  );
}

module.exports = { listMessages, markAsRead };
