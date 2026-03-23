'use strict';
const db = require('../../db');
const { runWorkflow } = require('./workflows');
const outboundWhatsApp = require('./outboundWhatsApp');
const { findAgentForAssignment } = require('./agentAssignment');
const { claimConversation } = require('./conversationClaim'); // Or reuse logic here

async function listRules() {
  const res = await db.query(
    `
    SELECT *
    FROM automation_rules
    ORDER BY created_at DESC
    `
  );
  return res.rows;
}

async function createRule(payload) {
  const {
    name,
    description,
    is_active = true,
    event_type,
    match_value,
    action_type,
    action_config = {},
  } = payload || {};

  const res = await db.query(
    `
    INSERT INTO automation_rules (
      name,
      description,
      is_active,
      event_type,
      match_value,
      action_type,
      action_config
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING *
    `,
    [
      name,
      description || null,
      Boolean(is_active),
      event_type,
      match_value,
      action_type,
      JSON.stringify(action_config || {}),
    ]
  );

  return res.rows[0];
}

async function updateRule(id, payload) {
  const fields = [];
  const values = [];

  function add(field, value) {
    fields.push(field);
    values.push(value);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    add('name', payload.name);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    add('description', payload.description);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'is_active')) {
    add('is_active', Boolean(payload.is_active));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'event_type')) {
    add('event_type', payload.event_type);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'match_value')) {
    add('match_value', payload.match_value);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'action_type')) {
    add('action_type', payload.action_type);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'action_config')) {
    add('action_config', JSON.stringify(payload.action_config || {}));
  }

  if (!fields.length) {
    const existing = await db.query('SELECT * FROM automation_rules WHERE id = $1', [id]);
    return existing.rows[0] || null;
  }

  const setClause = fields
    .map((field, idx) => {
      if (field === 'action_config') {
        return `${field} = $${idx + 1}::jsonb`;
      }
      return `${field} = $${idx + 1}`;
    })
    .join(', ');

  const res = await db.query(
    `
    UPDATE automation_rules
    SET ${setClause}
    WHERE id = $${fields.length + 1}
    RETURNING *
    `,
    [...values, id]
  );

  return res.rows[0] || null;
}

async function deleteRule(id) {
  await db.query('DELETE FROM automation_rules WHERE id = $1', [id]);
  return { success: true };
}

async function evaluateMessageRules(phoneNumber, textBody, channelId) {
  if (!phoneNumber || !textBody) return [];

  const res = await db.query(
    `
    SELECT *
    FROM automation_rules
    WHERE is_active = TRUE
      AND event_type = 'message_text'
    `
  );

  const rules = res.rows || [];
  const matched = [];
  const lowerText = textBody.toLowerCase();

  for (const rule of rules) {
    const raw = (rule.match_value || '').toLowerCase().trim();
    let hit = false;
    
    if (!raw) {
      // Catch-all: blank match_value matches EVERYTHING
      hit = true;
      console.log(`[Rules] Catch-all rule matched for rule ${rule.id}`);
    } else {
      const tokens = raw.split(',').map((v) => v.trim()).filter(Boolean);
      if (tokens.length > 0) {
        hit = tokens.some((token) => lowerText.includes(token));
      }
    }

    if (hit) {
      matched.push(rule);
      await performRuleAction(rule, phoneNumber, channelId);
    }
  }

  return matched;
}

async function evaluateCourseRules(phoneNumber, courseValue, channelId) {
  if (!phoneNumber || !courseValue) return [];

  const res = await db.query(
    `
    SELECT *
    FROM automation_rules
    WHERE is_active = TRUE
      AND event_type = 'course_equals'
    `
  );

  const rules = res.rows || [];
  const matched = [];
  const lowerCourse = String(courseValue).toLowerCase();

  for (const rule of rules) {
    const raw = (rule.match_value || '').toLowerCase();
    if (!raw) continue;

    const tokens = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    if (!tokens.length) continue;

    const hit = tokens.some((token) => lowerCourse === token);
    if (hit) {
      matched.push(rule);
      await performRuleAction(rule, phoneNumber, channelId);
    }
  }

  return matched;
}

async function evaluatePaymentRules(phoneNumber, paymentData, channelId) {
  if (!phoneNumber) return [];

  const res = await db.query(
    `
    SELECT *
    FROM automation_rules
    WHERE is_active = TRUE
      AND event_type = 'payment_received'
    `
  );

  const rules = res.rows || [];
  const matched = [];

  for (const rule of rules) {
    const matchValue = (rule.match_value || '').toLowerCase();
    const coursePaid = (paymentData.details?.course || '').toLowerCase();

    let hit = true;
    if (matchValue && coursePaid) {
      const tokens = matchValue.split(',').map(v => v.trim()).filter(Boolean);
      hit = tokens.some(t => coursePaid.includes(t));
    }

    if (hit) {
      matched.push(rule);
      await performRuleAction(rule, phoneNumber, channelId);
    }
  }

  return matched;
}

async function performRuleAction(rule, phoneNumber, channelId) {
  const actionType = rule.action_type;
  const cfg = rule.action_config || {};

  if (actionType === 'send_message') {
    const text = cfg.message || cfg.text;
    if (!text) return;

    try {
      const conversationId = await ensureConversationForRule(phoneNumber, channelId);
      await outboundWhatsApp.sendText(conversationId, text);
    } catch (err) {
      console.error('[Rules] Failed to send message for rule', rule.id, err);
    }
  } else if (actionType === 'start_workflow') {
    let workflowId = cfg.workflow_id || cfg.workflowId;
    // Handle potential object format { value, label } from GreetUI
    if (workflowId && typeof workflowId === 'object') {
      workflowId = workflowId.value || workflowId.id;
    }
    
    if (!workflowId) {
      console.warn('[Rules] Rule', rule.id, 'has start_workflow action but no workflowId in config');
      return;
    }

    try {
      await runWorkflow(workflowId, phoneNumber, { channelId });
    } catch (err) {
      console.error('[Rules] Failed to start workflow for rule', rule.id, err);
    }
  } else if (actionType === 'notify_admin') {
    const text = cfg.message || cfg.text || `Notification from rule: ${rule.name}`;
    const { getIO } = require('../realtime/io');
    const io = getIO();
    if (io) {
      io.emit('staff:notification', {
        type: 'rule_alert',
        title: rule.name,
        message: text,
        phoneNumber,
        ruleId: rule.id
      });
      console.log(`[Rules] Admin notified for rule ${rule.id}`);
    }
  } else if (actionType === 'assign_agent') {
    const conditions = {
      course: cfg.course,
      language: cfg.language
    };
    
    try {
      const agentId = await findAgentForAssignment(conditions);
      if (agentId) {
        const conversationId = await ensureConversationForRule(phoneNumber, channelId);
        if (conversationId) {
          // Find team for user
          const teamRes = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [agentId]);
          const teamId = teamRes.rows[0]?.team_id;
          
          // Assign using claim logic or direct insert
          // We'll use direct insert for simplicity as system override
          await db.query(`
            INSERT INTO conversation_assignments (conversation_id, team_id, assignee_user_id, claimed_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (conversation_id) WHERE released_at IS NULL
            DO UPDATE SET assignee_user_id = EXCLUDED.assignee_user_id, team_id = EXCLUDED.team_id, claimed_at = NOW()
          `, [conversationId, teamId, agentId]);
          
          console.log(`[Rules] Assigned conversation ${conversationId} to agent ${agentId} based on conditions`, conditions);
        }
      } else {
        console.warn(`[Rules] No agent found matching conditions`, conditions);
      }
    } catch (err) {
      console.error('[Rules] Failed to assign agent for rule', rule.id, err);
    }
  }
}

async function ensureConversationForRule(phoneNumber, channelId) {
  let contactRes = await db.query(
    'SELECT id, channel_id FROM contacts WHERE external_id = $1 AND (channel_id = $2 OR $2 IS NULL)',
    [phoneNumber, channelId]
  );

  if (contactRes.rows.length === 0) {
    const altPhone = phoneNumber.startsWith('+')
      ? phoneNumber.slice(1)
      : `+${phoneNumber}`;
    contactRes = await db.query(
      'SELECT id, channel_id FROM contacts WHERE external_id = $1 AND (channel_id = $2 OR $2 IS NULL)',
      [altPhone, channelId]
    );
  }

  if (contactRes.rows.length === 0) {
     let targetChannelId = channelId;
     if (!targetChannelId) {
        const channelRes = await db.query(
          "SELECT id FROM channels WHERE type = 'whatsapp' LIMIT 1"
        );
        if (channelRes.rowCount === 0) {
          throw new Error('No WhatsApp channel configured');
        }
        targetChannelId = channelRes.rows[0].id;
     }

    const createContact = await db.query(
      `
      INSERT INTO contacts (id, channel_id, external_id, display_name, profile)
      VALUES (gen_random_uuid(), $1, $2, 'Unknown', '{}'::jsonb)
      RETURNING id
      `,
      [targetChannelId, phoneNumber]
    );
    const contactId = createContact.rows[0].id;

    const createConv = await db.query(
      `
      INSERT INTO conversations (id, channel_id, contact_id, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, 'open', NOW(), NOW())
      RETURNING id
      `,
      [targetChannelId, contactId]
    );
    return createConv.rows[0].id;
  }

  const contact = contactRes.rows[0];
  const contactId = contact.id;
  const actualChannelId = contact.channel_id;

  const convRes = await db.query(
    `
    SELECT id
    FROM conversations
    WHERE contact_id = $1 AND channel_id = $2
    ORDER BY created_at ASC
    LIMIT 1
    `,
    [contactId, actualChannelId]
  );

  if (convRes.rows.length > 0) {
    return convRes.rows[0].id;
  }

  const createConv = await db.query(
    `
    INSERT INTO conversations (id, channel_id, contact_id, status, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, 'open', NOW(), NOW())
    RETURNING id
    `,
    [actualChannelId, contactId]
  );
  return createConv.rows[0].id;
}

module.exports = {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  evaluateMessageRules,
  evaluateCourseRules,
  evaluatePaymentRules,
};
