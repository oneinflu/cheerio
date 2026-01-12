'use strict';
const db = require('../../db');

async function listMessages(conversationId) {
  const msgs = await db.query(
    `
    SELECT id, conversation_id, direction, content_type, text_body, raw_payload, created_at
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
  return msgs.rows.map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    direction: m.direction,
    contentType: m.content_type,
    textBody: m.text_body,
    rawPayload: m.raw_payload,
    createdAt: m.created_at,
    attachments: attByMsg.get(m.id) || [],
  }));
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

