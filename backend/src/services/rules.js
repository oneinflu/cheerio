'use strict';
const db = require('../../db');
const { runWorkflow } = require('./workflows');
const outboundWhatsApp = require('./outboundWhatsApp');

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

async function evaluateMessageRules(phoneNumber, textBody) {
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
    const value = (rule.match_value || '').toLowerCase();
    if (!value) continue;

    if (lowerText.includes(value)) {
      matched.push(rule);
      await performRuleAction(rule, phoneNumber);
    }
  }

  return matched;
}

async function evaluateCourseRules(phoneNumber, courseValue) {
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
    const value = (rule.match_value || '').toLowerCase();
    if (!value) continue;

    if (lowerCourse === value) {
      matched.push(rule);
      await performRuleAction(rule, phoneNumber);
    }
  }

  return matched;
}

async function performRuleAction(rule, phoneNumber) {
  const actionType = rule.action_type;
  const cfg = rule.action_config || {};

  if (actionType === 'send_message') {
    const text = cfg.message || cfg.text;
    if (!text) return;

    try {
      const conversationId = await ensureConversationForRule(phoneNumber);
      await outboundWhatsApp.sendText(conversationId, text);
    } catch (err) {
      console.error('[Rules] Failed to send message for rule', rule.id, err);
    }
  } else if (actionType === 'start_workflow') {
    const workflowId = cfg.workflow_id;
    if (!workflowId) return;

    try {
      await runWorkflow(workflowId, phoneNumber);
    } catch (err) {
      console.error('[Rules] Failed to start workflow for rule', rule.id, err);
    }
  }
}

async function ensureConversationForRule(phoneNumber) {
  let contactRes = await db.query(
    'SELECT id, channel_id FROM contacts WHERE external_id = $1',
    [phoneNumber]
  );

  if (contactRes.rows.length === 0) {
    const altPhone = phoneNumber.startsWith('+')
      ? phoneNumber.slice(1)
      : `+${phoneNumber}`;
    contactRes = await db.query(
      'SELECT id, channel_id FROM contacts WHERE external_id = $1',
      [altPhone]
    );
  }

  if (contactRes.rows.length === 0) {
    const channelRes = await db.query(
      "SELECT id FROM channels WHERE type = 'whatsapp' LIMIT 1"
    );
    if (channelRes.rowCount === 0) {
      throw new Error('No WhatsApp channel configured');
    }
    const channelId = channelRes.rows[0].id;

    const createContact = await db.query(
      `
      INSERT INTO contacts (id, channel_id, external_id, display_name, profile)
      VALUES (gen_random_uuid(), $1, $2, 'Unknown', '{}'::jsonb)
      RETURNING id
      `,
      [channelId, phoneNumber]
    );
    const contactId = createContact.rows[0].id;

    const createConv = await db.query(
      `
      INSERT INTO conversations (id, channel_id, contact_id, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, 'open', NOW(), NOW())
      RETURNING id
      `,
      [channelId, contactId]
    );
    return createConv.rows[0].id;
  }

  const contact = contactRes.rows[0];
  const contactId = contact.id;
  const channelId = contact.channel_id;

  const convRes = await db.query(
    `
    SELECT id
    FROM conversations
    WHERE contact_id = $1
    ORDER BY created_at ASC
    LIMIT 1
    `,
    [contactId]
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
    [channelId, contactId]
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
};

