'use strict';
const db = require('../../db');

async function listConversations(teamId, userId, filter = 'open') {
  const params = [userId];
  let whereClause = '';

  // Determine filter logic
  switch (filter) {
    case 'unassigned':
      whereClause = "AND c.status = 'open' AND ca.assignee_user_id IS NULL";
      break;
    case 'assigned_to_me':
      whereClause = "AND c.status = 'open' AND ca.assignee_user_id = $1";
      break;
    case 'pinned':
      // Show all pinned conversations regardless of status? 
      // Usually users want to see pinned items.
      whereClause = "AND pc.user_id IS NOT NULL";
      break;
    case 'resolved':
      whereClause = "AND c.status = 'closed'";
      break;
    case 'mentions':
      // Placeholder: currently treating as open, or we can implement mention logic later
      whereClause = "AND c.status = 'open'";
      break;
    default:
      // 'open' or 'all' (default view)
      whereClause = "AND c.status IN ('open','snoozed')";
      break;
  }

  const res = await db.query(
    `
    SELECT c.id,
           c.status,
           c.last_message_at,
           ct.display_name,
           ct.external_id AS contact_external_id,
           ch.type as channel_type,
           ch.external_id AS channel_external_id,
           ca.assignee_user_id,
           (pc.user_id IS NOT NULL) AS is_pinned,
           (
             SELECT COUNT(*)::int
             FROM messages m
             WHERE m.conversation_id = c.id
               AND m.direction = 'inbound'
               AND m.read_at IS NULL
           ) AS unread_count
    FROM conversations c
    JOIN contacts ct ON ct.id = c.contact_id
    JOIN channels ch ON ch.id = c.channel_id
    LEFT JOIN conversation_assignments ca
      ON ca.conversation_id = c.id AND ca.released_at IS NULL
    LEFT JOIN pinned_conversations pc
      ON pc.conversation_id = c.id AND pc.user_id = $1
    WHERE 1=1 ${whereClause}
    ORDER BY is_pinned DESC, c.last_message_at DESC NULLS LAST, c.created_at DESC
    `,
    params
  ).catch(err => {
    console.error('Error executing listConversations query:', err);
    throw err;
  });

  return res.rows.map((r) => ({
    id: r.id,
    status: r.status,
    lastMessageAt: r.last_message_at,
    contactName: r.display_name || 'Unknown',
    contactExternalId: r.contact_external_id,
    channelType: r.channel_type,
    channelExternalId: r.channel_external_id,
    assigneeUserId: r.assignee_user_id || null,
    isPinned: r.is_pinned,
    unreadCount: r.unread_count || 0,
  }));
}

async function getInboxCounts(teamId, userId) {
  const params = [userId];
  const res = await db.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE c.status IN ('open', 'snoozed'))::int AS count_all,
      COUNT(*) FILTER (WHERE c.status = 'open' AND ca.assignee_user_id IS NULL)::int AS count_unassigned,
      COUNT(*) FILTER (WHERE c.status = 'open' AND ca.assignee_user_id = $1)::int AS count_assigned_to_me,
      COUNT(*) FILTER (WHERE pc.user_id IS NOT NULL)::int AS count_pinned,
      COUNT(*) FILTER (WHERE c.status = 'closed')::int AS count_resolved
    FROM conversations c
    LEFT JOIN conversation_assignments ca
      ON ca.conversation_id = c.id AND ca.released_at IS NULL
    LEFT JOIN pinned_conversations pc
      ON pc.conversation_id = c.id AND pc.user_id = $1
    `,
    params
  );

  const row = res.rows[0];
  return {
    all: row.count_all,
    unassigned: row.count_unassigned,
    assigned_to_me: row.count_assigned_to_me,
    pinned: row.count_pinned,
    resolved: row.count_resolved,
  };
}

module.exports = { listConversations, getInboxCounts };
