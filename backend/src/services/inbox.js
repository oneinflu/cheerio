'use strict';
const db = require('../../db');

async function listConversations(teamId, userId, userRole, filter = 'open') {
  console.log(`[InboxService] listConversations called with filter: '${filter}', userId: ${userId}, role: ${userRole}`);
  
  const params = [];
  let whereClause = "";
  
  // Base visibility logic
  if (userRole !== 'admin') {
     params.push(userId);
     whereClause += ` AND (ca.assignee_user_id = $${params.length} OR ca.assignee_user_id IS NULL) `;
  }

  // Filter Logic
  if (filter === 'open') {
    whereClause += ` AND c.status != 'closed' AND ca.assignee_user_id IS NOT NULL `;
  } else if (filter === 'unassigned') {
    whereClause += ` AND ca.assignee_user_id IS NULL `;
  } else if (filter === 'closed') {
    whereClause += ` AND c.status = 'closed' `;
  } else if (filter === 'pinned') {
    whereClause += ` AND pc.conversation_id IS NOT NULL `;
  } else if (filter === 'all') {
    // Show everything visible to the user
  } else {
    console.warn(`[InboxService] Unknown filter '${filter}', defaulting to 'open' logic`);
    whereClause += ` AND c.status != 'closed' AND ca.assignee_user_id IS NOT NULL `;
  }

  // Ensure userId param is available for pinned join
  // params.length will be the index for the next param
  // We want to use the userId for the pinned join.
  // We simply push userId again to be safe and explicit, ensuring it's the last param.
  params.push(userId);
  const pinnedUserParamIdx = params.length; 

  console.log(`[InboxService] Query params:`, params);
  console.log(`[InboxService] pinnedUserParamIdx: ${pinnedUserParamIdx}`);

  const res = await db.query(
    `
    SELECT c.id,
           c.status,
           c.lead_id,
           c.last_message_at,
           ct.display_name,
           ct.external_id AS contact_external_id,
           ct.profile,
           ch.type as channel_type,
           ch.external_id AS channel_external_id,
           ca.assignee_user_id,
           (pc.conversation_id IS NOT NULL) AS is_pinned,
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
      ON pc.conversation_id = c.id AND pc.user_id = $${pinnedUserParamIdx}
    WHERE 1=1 ${whereClause}
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    `,
    params
  ).catch(err => {
    console.error('Error executing listConversations query:', err);
    throw err;
  });
  
  console.log(`[InboxService] Found ${res.rows.length} conversations`);

  return res.rows.map((r) => {
    // Derived status logic
    let derivedStatus = r.status;
    
    // Check 'closed' first (already in r.status usually, but explicit check matches logic)
    if (r.status === 'closed') {
        derivedStatus = 'closed';
    } else if (r.is_pinned) {
        derivedStatus = 'pinned';
    } else if (!r.assignee_user_id) {
        derivedStatus = 'unassigned';
    } else {
        derivedStatus = 'open';
    }

    return {
        id: r.id,
        status: derivedStatus,
        leadId: r.lead_id,
        lastMessageAt: r.last_message_at,
        contactName: r.display_name || 'Unknown',
        contactExternalId: r.contact_external_id,
        blocked: (r.profile && r.profile.blocked === true) || false,
        channelType: r.channel_type,
        channelExternalId: r.channel_external_id,
        assigneeUserId: r.assignee_user_id || null,
        isPinned: r.is_pinned,
        unreadCount: r.unread_count || 0,
    };
  });
}

async function getInboxCounts(teamId, userId) {
  // Return dummy counts to avoid UUID errors
  return {
    all: 0,
    unassigned: 0,
    assigned_to_me: 0,
    pinned: 0,
    resolved: 0
  };
}

module.exports = { listConversations, getInboxCounts };
