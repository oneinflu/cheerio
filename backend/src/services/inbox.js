'use strict';
const db = require('../../db');
const { PRIVILEGED_ROLES } = require('../middlewares/auth');

const axios = require('axios');

async function syncUnassignedConversations(conversations) {
  // Only check unassigned conversations with a lead_id (or sufficient info to fetch lead)
  const unassigned = conversations.filter(c => !c.assignee_user_id && c.contact_external_id);
  if (unassigned.length === 0) return;

  console.log(`[InboxService] Syncing ${unassigned.length} unassigned conversations with Starforze...`);

  for (const conv of unassigned) {
    try {
      // We need mobile number. contact_external_id is usually the phone number.
      let mobile = conv.contact_external_id;
      if (mobile.startsWith('91') && mobile.length > 10) mobile = mobile.slice(2);

      // Fetch lead details from Starforze (using webhook or leads endpoint logic)
      // The user mentioned "get dta from the starforze.com"
      // Assuming we can use the same endpoint as the webhook or a lookup.
      // Since there's no direct "GET /api/leads/by-mobile", we might rely on the lead creation endpoint 
      // which often returns existing lead data, OR we use the lead_id if we have it.

      let assignedTo = null;
      let leadId = conv.lead_id;

      if (leadId) {
        // If we have a lead ID, fetch specific lead
        try {
          const res = await axios.get(`https://api.starforze.com/api/leads/${leadId}`);
          if (res.data && res.data.data) {
            assignedTo = res.data.data.assignedTo;
          }
        } catch (e) {
          // If 404 or other error, ignore
        }
      }

      // If no lead_id or fetch failed, try the webhook approach which returns lead data
      if (!assignedTo) {
        const res = await axios.post('https://api.starforze.com/api/webhook/whatsapp-lead', {
          mobile: mobile,
          name: conv.display_name || 'Unknown',
          course: '' // Just checking
        });
        if (res.data && res.data.data) {
          const leadData = res.data.data;
          assignedTo = leadData.assignedTo;

          // If we got a lead ID from the webhook response, update our records
          if (leadData.lead && leadData.lead._id) {
            const newLeadId = leadData.lead._id;
            if (newLeadId !== leadId) {
              console.log(`[InboxService] Updating lead_id for conversation ${conv.id} to ${newLeadId}`);
              // Update conversation
              await db.query('UPDATE conversations SET lead_id = $1 WHERE id = $2', [newLeadId, conv.id]);

              // Update contact profile
              await db.query(`
                                UPDATE contacts 
                                SET profile = jsonb_set(COALESCE(profile, '{}'), '{leadId}', to_jsonb($1::text), true)
                                WHERE external_id LIKE $2
                             `, [newLeadId, `%${mobile}%`]);
            }
          }
        }
      }

      // If we found an assignee, update our DB
      if (assignedTo && (assignedTo._id || assignedTo.id)) {
        const userId = assignedTo._id || assignedTo.id;
        // Check if user exists in our local DB? 
        // Ideally yes, but if not we might just store the ID if we blindly trust it, 
        // OR we assume the user table is synced.
        // For safety, let's just insert into assignments.

        console.log(`[InboxService] Auto-assigning conversation ${conv.id} to ${userId}`);

        await db.query(
          `INSERT INTO conversation_assignments (id, conversation_id, assignee_user_id, claimed_at)
                     VALUES (gen_random_uuid(), $1, $2, NOW())
                     ON CONFLICT (conversation_id) WHERE released_at IS NULL DO NOTHING`,
          [conv.id, userId]
        );
      }
    } catch (err) {
      console.error(`[InboxService] Failed to sync conversation ${conv.id}:`, err.message);
    }
  }
}

async function listConversations(teamId, userId, userRole, filter = 'open', phoneNumberId = null) {
  console.log(`[InboxService] listConversations filter='${filter}', userId=${userId}, phone='${phoneNumberId}'`);

  const params = [];
  let whereClause = "";

  // Team Filter (Mandatory if teamId provided)
  if (teamId) {
    params.push(teamId);
    whereClause += ` AND (ws.team_id = $${params.length} OR ca.team_id = $${params.length}) `;
  }

  // Phone Number Filter
  if (phoneNumberId) {
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
           c.status,
           c.lead_id,
           c.lead_stage_id,
           c.last_message_at,
           ct.display_name,
           ct.external_id AS contact_external_id,
           ct.profile,
           ch.type as channel_type,
           ch.external_id AS channel_external_id,
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
  // --- SYNC LOGIC START ---
  // Trigger sync in background for TOP 5 unassigned items to avoid timeouts
  const unassigned = rows.filter(r => !r.assignee_user_id);

  if (unassigned.length > 0) {
    const toSync = unassigned.slice(0, 5);
    // Explicitly do NOT await the sync to avoid timeouts
    syncUnassignedConversations(toSync).catch(e => console.error('[InboxSync] Error:', e));


    if (toSync.length > 0) {
      const idsToCheck = toSync.map(r => r.id);
      const newAssignments = await db.query(
        `SELECT conversation_id, assignee_user_id FROM conversation_assignments 
               WHERE conversation_id = ANY($1::uuid[]) AND released_at IS NULL`,
        [idsToCheck]
      );

      for (const assign of newAssignments.rows) {
        const row = rows.find(r => r.id === assign.conversation_id);
        if (row) {
          row.assignee_user_id = assign.assignee_user_id;
        }
      }
    }
  }
  // --- SYNC LOGIC END ---

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
      status: derivedStatus,
      leadId: r.lead_id,
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
      channelDisplayName: r.channel_display_number || r.channel_external_id,
      assigneeUserId: r.assignee_user_id || null,
      isPinned: r.is_pinned,
      unreadCount: r.unread_count || 0,
    };
  });
}

async function getInboxCounts(teamId, userId) {
  try {
    const res = await db.query(
      `
      SELECT 
        COUNT(*)::int as all,
        COUNT(*) FILTER (WHERE ca.assignee_user_id IS NULL AND c.status != 'closed')::int as unassigned,
        COUNT(*) FILTER (WHERE ca.assignee_user_id = $1 AND c.status != 'closed')::int as assigned_to_me,
        COUNT(*) FILTER (WHERE pc.conversation_id IS NOT NULL AND c.status != 'closed')::int as pinned,
        COUNT(*) FILTER (WHERE c.status = 'closed')::int as resolved
      FROM conversations c
      LEFT JOIN conversation_assignments ca ON ca.conversation_id = c.id AND ca.released_at IS NULL
      LEFT JOIN pinned_conversations pc ON pc.conversation_id = c.id AND pc.user_id = $1
      `,
      [userId]
    );
    return res.rows[0];
  } catch (err) {
    console.error('[InboxService] Failed to get counts:', err);
    return { all: 0, unassigned: 0, assigned_to_me: 0, pinned: 0, resolved: 0 };
  }
}


module.exports = { listConversations, getInboxCounts };
