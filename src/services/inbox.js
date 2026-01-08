'use strict';
const db = require('../../db');

async function listConversations(teamId) {
  const res = await db.query(
    `
    SELECT c.id,
           c.status,
           c.last_message_at,
           ct.display_name,
           ch.type as channel_type,
           ca.assignee_user_id
    FROM conversations c
    JOIN contacts ct ON ct.id = c.contact_id
    JOIN channels ch ON ch.id = c.channel_id
    LEFT JOIN conversation_assignments ca
      ON ca.conversation_id = c.id AND ca.released_at IS NULL
    WHERE c.status IN ('open','snoozed')
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    `
  );
  return res.rows.map((r) => ({
    id: r.id,
    status: r.status,
    lastMessageAt: r.last_message_at,
    contactName: r.display_name || 'Unknown',
    channelType: r.channel_type,
    assigneeUserId: r.assignee_user_id || null,
  }));
}

module.exports = { listConversations };

