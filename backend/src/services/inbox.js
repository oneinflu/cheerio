'use strict';
const db = require('../../db');
const { PRIVILEGED_ROLES } = require('../middlewares/auth');

const axios = require('axios');

// Starforze Sync logic REMOVED


async function listConversations(teamId, userId, userRole, filter = 'open', phoneNumberId = null) {
  console.log(`[InboxService] listConversations filter='${filter}', userId=${userId}, phone='${phoneNumberId}'`);

  const params = [];
  let whereClause = "";

  // Team Filter (Mandatory if teamId provided)
  if (teamId) {
    params.push(teamId);
    // Include conversations where:
    // 1. The WhatsApp settings belong to this team, OR
    // 2. The conversation assignment belongs to this team, OR
    // 3. There's no whatsapp_settings row at all (so we don't exclude channels without settings)
    whereClause += ` AND (ws.team_id = $${params.length} OR ca.team_id = $${params.length} OR ws.team_id IS NULL) `;
  }

  // Phone Number Filter (FORCED to .env if present)
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (envPhoneId) {
    params.push(envPhoneId);
    whereClause += ` AND ch.external_id = $${params.length} `;
  } else if (phoneNumberId) {
    params.push(phoneNumberId);
    whereClause += ` AND ch.external_id = $${params.length} `;
  }

  // Base visibility logic
  if (!PRIVILEGED_ROLES.has(userRole)) {
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
           c.channel_id,
           c.status,
           c.lead_id,
           c.lead_stage_id,
           c.last_message_at,
           c.is_ai_active,
           ct.display_name,
           ct.external_id AS contact_external_id,
           ct.profile,
           ch.type as channel_type,
           ch.external_id AS channel_external_id,
           ch.name AS channel_name,
           ws.display_phone_number AS channel_display_number,
           ca.assignee_user_id,
           ls.name AS lead_stage_name,
           ls.color AS lead_stage_color,
           ls.is_closed AS lead_stage_is_closed,
           (pc.conversation_id IS NOT NULL) AS is_pinned,
           (
             SELECT m2.text_body 
             FROM messages m2 
             WHERE m2.conversation_id = c.id 
             ORDER BY m2.created_at DESC 
             LIMIT 1
           ) AS last_message_body,
           (
             SELECT m2.content_type
             FROM messages m2
             WHERE m2.conversation_id = c.id
             ORDER BY m2.created_at DESC
             LIMIT 1
           ) AS last_message_type,
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
    -- Join with settings to filter by team
    LEFT JOIN whatsapp_settings ws ON ws.phone_number_id = ch.external_id AND ch.type = 'whatsapp'
    LEFT JOIN conversation_assignments ca
      ON ca.conversation_id = c.id AND ca.released_at IS NULL
    LEFT JOIN lead_stages ls
      ON ls.id = c.lead_stage_id
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

  const rows = res.rows;
  // --- SYNC LOGIC REMOVED ---


  return rows.map((r) => {
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
      channelId: r.channel_id,
      status: derivedStatus,
      leadId: r.lead_id,
      is_ai_active: r.is_ai_active,
      leadStage: r.lead_stage_id
        ? {
          id: r.lead_stage_id,
          name: r.lead_stage_name,
          color: r.lead_stage_color,
          isClosed: r.lead_stage_is_closed === true,
        }
        : null,
      lastMessageAt: r.last_message_at,
      lastMessage: r.last_message_type === 'text' ? r.last_message_body : (r.last_message_type ? `[${r.last_message_type}]` : null),
      contactName: r.display_name || 'Unknown',
      contactExternalId: r.contact_external_id,
      blocked: (r.profile && r.profile.blocked === true) || false,
      channelType: r.channel_type,
      channelExternalId: r.channel_external_id,
      channelDisplayName: r.channel_display_number || r.channel_name || r.channel_external_id,
      assigneeUserId: r.assignee_user_id || null,
      isPinned: r.is_pinned,
      unreadCount: r.unread_count || 0,
    };
  });
}

async function getInboxCounts(teamId, userId, userRole) {
  try {
    const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const isPrivileged = PRIVILEGED_ROLES.has(userRole);
    const params = [];
    
    let teamFilter = '';
    let teamFilterSub = '';
    if (teamId) {
      params.push(teamId);
      teamFilter = ` AND (ws.team_id = $${params.length} OR ca.team_id = $${params.length} OR ws.team_id IS NULL) `;
      teamFilterSub = ` AND (ws2.team_id = $${params.length} OR ca2.team_id = $${params.length} OR ws2.team_id IS NULL) `;
    }

    params.push(userId);
    const userIdx = params.length;

    let visibilityFilter = '';
    let visibilityFilterSub = '';
    if (!isPrivileged) {
      visibilityFilter = ` AND (ca.assignee_user_id = $${userIdx} OR ca.assignee_user_id IS NULL) `;
      visibilityFilterSub = ` AND (ca2.assignee_user_id = $${userIdx} OR ca2.assignee_user_id IS NULL) `;
    }

    let phoneFilter = '';
    if (envPhoneId) {
      params.push(envPhoneId);
      phoneFilter = ` AND ch.external_id = $${params.length} `;
    }

    const query = `
      SELECT 
        COUNT(DISTINCT c.id)::int as all,
        COUNT(DISTINCT c.id) FILTER (WHERE ca.assignee_user_id IS NULL AND c.status != 'closed')::int as unassigned,
        COUNT(DISTINCT c.id) FILTER (WHERE ca.assignee_user_id = $${userIdx} AND c.status != 'closed')::int as assigned_to_me,
        COUNT(DISTINCT c.id) FILTER (WHERE pc.conversation_id IS NOT NULL AND c.status != 'closed')::int as pinned,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'closed')::int as resolved,
        COALESCE(SUM(
          (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.direction = 'inbound' AND m.read_at IS NULL)
        ) FILTER (WHERE c.status != 'closed'), 0)::int as unread
      FROM conversations c
      JOIN channels ch ON ch.id = c.channel_id
      LEFT JOIN whatsapp_settings ws ON ws.phone_number_id = ch.external_id AND ch.type = 'whatsapp'
      LEFT JOIN conversation_assignments ca ON ca.conversation_id = c.id AND ca.released_at IS NULL
      LEFT JOIN pinned_conversations pc ON pc.conversation_id = c.id AND pc.user_id = $${userIdx}
      WHERE 1=1 ${teamFilter} ${visibilityFilter} ${phoneFilter}
    `;

    const res = await db.query(query, params);
    return res.rows[0];
  } catch (err) {
    console.error('[InboxService] Failed to get counts:', err);
    return { all: 0, unassigned: 0, assigned_to_me: 0, pinned: 0, resolved: 0, unread: 0 };
  }
}


module.exports = { listConversations, getInboxCounts };
