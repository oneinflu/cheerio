'use strict';
const db = require('../../db');
const whatsappClient = require('../integrations/meta/whatsappClient');
const outboundWhatsApp = require('./outboundWhatsApp');
const razorpay = require('./razorpay');
const { findAgentForAssignment } = require('./agentAssignment');
const axios = require('axios');
const zeptoMail = require('./zeptoMail');
const fast2sms = require('./fast2sms');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

/**
 * Resolve {{variable}} placeholders in a string against a context object.
 * e.g. resolvePlaceholders('Hello {{name}}', { name: 'John' }) => 'Hello John'
 */
function resolvePlaceholders(str, context) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const k = key.trim();
    if (Object.prototype.hasOwnProperty.call(context, k)) return String(context[k]);
    
    // Support dotted paths (e.g. xolox_response.assignedTo)
    const segments = k.split('.');
    if (segments.length > 1) {
      let val = context;
      for (const seg of segments) {
        if (val && typeof val === 'object' && seg in val) {
          val = val[seg];
        } else {
          val = undefined;
          break;
        }
      }
      if (val !== undefined) return String(val ?? '');
    }
    
    return `{{${k}}}`;
  });
}

function buildContextPreview(context) {
  const out = {};
  const src = context && typeof context === 'object' ? context : {};
  const preferred = ['phone', 'name', 'email', 'contact_id', 'course', 'tags'];
  const keys = [...preferred, ...Object.keys(src)].filter((v, i, a) => a.indexOf(v) === i);
  for (const k of keys.slice(0, 15)) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    const v = src[k];
    if (v === null || v === undefined) continue;
    let s;
    if (typeof v === 'string') s = v;
    else if (typeof v === 'number' || typeof v === 'boolean') s = String(v);
    else if (Array.isArray(v)) s = v.slice(0, 5).map((x) => String(x)).join(', ');
    else s = JSON.stringify(v);
    if (typeof s === 'string' && s.length > 160) s = s.slice(0, 157) + '...';
    out[k] = s;
  }
  return out;
}

/**
 * Service: Workflows
 * Manage automation workflows.
 */

// Helper to resolve conversationId for a phone number
async function ensureConversation(phoneNumber) {
  // Find contact
  let contactRes = await db.query('SELECT id, external_id, channel_id FROM contacts WHERE external_id = $1', [phoneNumber]);

  if (contactRes.rows.length === 0) {
    const altPhone = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : `+${phoneNumber}`;
    contactRes = await db.query('SELECT id, external_id, channel_id FROM contacts WHERE external_id = $1', [altPhone]);
  }

  if (contactRes.rows.length === 0) {
    // If contact doesn't exist, we can't create a conversation easily without knowing the channel.
    // However, if we assume a default channel exists, we could try.
    // For now, let's try to find ANY whatsapp channel to link to.
    // Prefer the real configured channel (numeric external_id = Meta Phone Number ID), not the demo seed
    const configuredPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let channelRes;
    if (configuredPhoneId) {
      channelRes = await db.query("SELECT id FROM channels WHERE type = 'whatsapp' AND external_id = $1 LIMIT 1", [configuredPhoneId]);
    }
    if (!channelRes || channelRes.rowCount === 0) {
      channelRes = await db.query("SELECT id FROM channels WHERE type = 'whatsapp' AND external_id ~ '^[0-9]+$' ORDER BY created_at DESC LIMIT 1");
    }
    if (!channelRes || channelRes.rowCount === 0) {
      channelRes = await db.query("SELECT id FROM channels WHERE type = 'whatsapp' LIMIT 1");
    }
    if (channelRes.rowCount === 0) throw new Error('No WhatsApp channel configured');
    const channelId = channelRes.rows[0].id;

    // Create contact
    const createContact = await db.query(
      `INSERT INTO contacts (id, channel_id, external_id, display_name, profile, lead_status, lead_stage)
       VALUES (gen_random_uuid(), $1, $2, 'Unknown', '{}'::jsonb, 'new', 'N2 Fresh Leads')
       RETURNING id`,
      [channelId, phoneNumber]
    );
    const contactId = createContact.rows[0].id;

    // Create conversation
    const createConv = await db.query(
      `INSERT INTO conversations (id, channel_id, contact_id, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'open', NOW(), NOW())
       RETURNING id`,
      [channelId, contactId]
    );
    return createConv.rows[0].id;
  }

  const contact = contactRes.rows[0];
  const contactId = contact.id;
  const channelId = contact.channel_id;

  // Find conversation
  const convRes = await db.query('SELECT id FROM conversations WHERE contact_id = $1', [contactId]);
  if (convRes.rows.length > 0) {
    return convRes.rows[0].id;
  }

  // Create new conversation if missing
  const createConv = await db.query(
    `INSERT INTO conversations (id, channel_id, contact_id, status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'open', NOW(), NOW())
     RETURNING id`,
    [channelId, contactId]
  );
  return createConv.rows[0].id;
}

// Ensure a contact exists and update basic fields; returns contact_id
async function ensureContact({ external_id, name, email, attributes, skipGlobalTriggers = false }) {
  let contactRes = await db.query('SELECT id, channel_id, display_name, profile FROM contacts WHERE external_id = $1', [external_id]);
  if (contactRes.rowCount === 0) {
    const alt = external_id.startsWith('+') ? external_id.slice(1) : `+${external_id}`;
    contactRes = await db.query('SELECT id, channel_id, display_name, profile FROM contacts WHERE external_id = $1', [alt]);
  }

  if (contactRes.rowCount === 0) {
    // Prefer the real configured channel (numeric external_id = Meta Phone Number ID), not the demo seed
    const configuredPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let chanRes;
    if (configuredPhoneId) {
      chanRes = await db.query("SELECT id FROM channels WHERE type='whatsapp' AND external_id = $1 LIMIT 1", [configuredPhoneId]);
    }
    if (!chanRes || chanRes.rowCount === 0) {
      chanRes = await db.query("SELECT id FROM channels WHERE type='whatsapp' AND external_id ~ '^[0-9]+$' ORDER BY created_at DESC LIMIT 1");
    }
    if (!chanRes || chanRes.rowCount === 0) {
      chanRes = await db.query("SELECT id FROM channels WHERE type='whatsapp' LIMIT 1");
    }
    if (chanRes.rowCount === 0) throw new Error('No WhatsApp channel configured');
    const channelId = chanRes.rows[0].id;
    const ins = await db.query(
      `INSERT INTO contacts (id, channel_id, external_id, display_name, profile, lead_status, lead_stage)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, 'new', 'N2 Fresh Leads')
       RETURNING *`,
      [channelId, external_id, name || 'User', JSON.stringify({ email: email || '', attributes: attributes || {} })]
    );
    const newContact = ins.rows[0];

    // Trigger NEW CONTACT workflows if not skipped
    if (!skipGlobalTriggers) {
      triggerContactCreatedWorkflows({
        id: newContact.id,
        external_id: newContact.external_id,
        name: newContact.display_name,
        email: newContact.profile?.email || '',
        attributes: newContact.profile?.attributes || {}
      }).catch(err => console.error('[ensureContact] Trigger failed:', err));
    }

    return newContact.id;
  }

  const contactId = contactRes.rows[0].id;
  const displayName = name || contactRes.rows[0].display_name || 'User';
  const attrJson = JSON.stringify(attributes || {});

  await db.query(
    `
    UPDATE contacts
    SET display_name = $2,
        profile = COALESCE(profile, '{}'::jsonb) ||
                 jsonb_build_object(
                   'email', COALESCE($3, (profile->>'email')),
                   'attributes', (COALESCE(profile->'attributes','{}'::jsonb) || $4::jsonb)
                 )
    WHERE id = $1
    `,
    [contactId, displayName, email || null, attrJson]
  );

  return contactId;
}


async function listWorkflows() {
  const res = await db.query(`
    SELECT * FROM workflows 
    ORDER BY created_at DESC
  `);
  return res.rows;
}

async function getWorkflow(id) {
  const res = await db.query(`
    SELECT * FROM workflows WHERE id = $1
  `, [id]);
  return res.rows[0];
}

async function createWorkflow(data) {
  const { name, description, status, steps } = data;
  const res = await db.query(`
    INSERT INTO workflows (name, description, status, steps)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [name, description, status || 'active', steps || []]);
  return res.rows[0];
}

async function updateWorkflow(id, data) {
  const { name, description, status, steps } = data;
  const res = await db.query(`
    UPDATE workflows 
    SET name = COALESCE($2, name),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        steps = COALESCE($5, steps)
    WHERE id = $1
    RETURNING *
  `, [id, name, description, status, steps]);
  return res.rows[0];
}

async function runStageWorkflows(stageId, phoneNumber) {
  const res = await db.query(
    `SELECT lsw.workflow_id, lsw.delay_minutes, lsw.is_independent, lsw.target_time, w.steps
     FROM lead_stage_workflows lsw
     JOIN workflows w ON w.id = lsw.workflow_id
     WHERE lsw.stage_id = $1 AND w.status = 'active'
     ORDER BY lsw.position ASC, w.created_at ASC`,
    [stageId]
  );
  
  // Fetch contact labels to check conditions
  let contactLabels = [];
  try {
    const contactRes = await db.query(
      `SELECT cl.name 
       FROM contacts c
       JOIN contact_label_maps clm ON clm.contact_id = c.id
       JOIN contact_labels cl ON cl.id = clm.label_id
       WHERE c.external_id = $1`,
      [phoneNumber]
    );
    if (contactRes.rowCount === 0) {
        const altPhone = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : `+${phoneNumber}`;
        const contactRes2 = await db.query(
          `SELECT cl.name 
           FROM contacts c
           JOIN contact_label_maps clm ON clm.contact_id = c.id
           JOIN contact_labels cl ON cl.id = clm.label_id
           WHERE c.external_id = $1`,
          [altPhone]
        );
        contactLabels = contactRes2.rows.map(r => r.name);
    } else {
        contactLabels = contactRes.rows.map(r => r.name);
    }
  } catch (e) {
    console.error(`[runStageWorkflows] Error fetching contact labels: ${e.message}`);
  }

  for (const row of res.rows) {
    const wfId = row.workflow_id;
    const steps = row.steps || {};

    if (row.is_independent) {
      console.log(`[runStageWorkflows] Skipping workflow ${wfId}: Marked as independent (unlinked)`);
      continue;
    }
    
    // Check label filter if present
    if (steps.triggerLabel) {
      if (!contactLabels.includes(steps.triggerLabel)) {
        console.log(`[runStageWorkflows] Skipping workflow ${wfId}: Lead does not have label "${steps.triggerLabel}"`);
        continue;
      }
    }

    // Check course/attribute filter if present
    if (steps.triggerCourse) {
        // We need to fetch contact profile for course check
        try {
            const profileRes = await db.query(
                `SELECT profile FROM contacts WHERE external_id = $1 OR external_id = $2 LIMIT 1`,
                [phoneNumber, phoneNumber.startsWith('+') ? phoneNumber.slice(1) : `+${phoneNumber}`]
            );
            const profile = profileRes.rows[0]?.profile || {};
            const contactCourse = profile.course || profile.Course || '';
            
            // Loose matching for course name
            if (!contactCourse || !contactCourse.toLowerCase().includes(steps.triggerCourse.toLowerCase())) {
                console.log(`[runStageWorkflows] Skipping workflow ${wfId}: Lead course "${contactCourse}" does not match "${steps.triggerCourse}"`);
                continue;
            }
        } catch (e) {
            console.error(`[runStageWorkflows] Error checking course: ${e.message}`);
            continue; // Skip if we can't verify course
        }
    }
    const delayMinutes = parseInt(row.delay_minutes || 0, 10);
      
    try {
      if (!isNaN(delayMinutes) && delayMinutes > 0) {
        console.log(`[runStageWorkflows] Delaying workflow ${wfId} for ${delayMinutes} mins (Target Phone: ${phoneNumber})`);
        await sleep(delayMinutes * 60 * 1000);
      }
      
      if (row.target_time) {
        const [targetH, targetM] = row.target_time.split(':').map(val => parseInt(val, 10) || 0);
        if (!isNaN(targetH)) {
          const now = new Date();
          let targetDate = new Date(now);
          targetDate.setHours(targetH, targetM || 0, 0, 0);
          
          if (targetDate < now) {
            targetDate.setDate(targetDate.getDate() + 1);
          }
          
          const waitMs = targetDate.getTime() - now.getTime();
          if (waitMs > 0) {
            console.log(`[runStageWorkflows] Waiting ${Math.round(waitMs/1000)}s until scheduled time ${row.target_time} for ${phoneNumber}`);
            await sleep(waitMs);
          }
        }
      }

      console.log(`[runStageWorkflows] Triggering workflow ${wfId} for ${phoneNumber}`);
      await runWorkflow(wfId, phoneNumber);
    } catch (e) {
      console.error(`[runStageWorkflows] Workflow ${wfId} execution path failed: ${e.message}`);
      break; 
    }
  }
}
async function deleteWorkflow(id) {
  await db.query(`DELETE FROM workflows WHERE id = $1`, [id]);
  return { success: true };
}

async function triggerWorkflowsForEvent(triggerType, phoneNumber, context = {}, excludeWorkflowId = null) {
  if (!triggerType) return;
  console.log(`[WorkflowEvents] Checking workflows for trigger type: ${triggerType}`);
  try {
    const res = await db.query(
      `SELECT id, steps FROM workflows WHERE status = 'active'`
    );
    const rows = res.rows || [];
    for (const row of rows) {
      const id = row.id;
      if (excludeWorkflowId && String(id) === String(excludeWorkflowId)) continue;
      const steps = row.steps || {};
      // steps might be stored as { trigger: 'new_contact', nodes: [...], edges: [...] }
      const wfTrigger = steps.trigger || steps.event || null;
      
      // Basic event type match
      let isMatch = (wfTrigger === triggerType);

      // Enhanced Keyword matching for WhatsApp Incoming
      if (triggerType === 'incoming_whatsapp' && !isMatch) {
          // Check if this workflow intended to trigger on incoming_whatsapp
          // Some legacies use 'trigger' or 'incoming_whatsapp'
          const nodes = steps.nodes || [];
          const triggerNode = nodes.find(n => n.type === 'trigger' || n.type === 'incoming_whatsapp');
          
          if (triggerNode) {
              const keywords = triggerNode.data?.keywords || '';
              const incomingText = (context.text || '').toLowerCase().trim();

              if (!keywords.trim()) {
                  // Catch-all: blank keywords match EVERYTHING
                  isMatch = true;
                  console.log(`[WorkflowEvents] Catch-all match for workflow ${id} (blank keywords)`);
              } else {
                  // Split by comma and match
                  const tokens = keywords.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
                  isMatch = tokens.some(t => incomingText.includes(t));
                  if (isMatch) console.log(`[WorkflowEvents] Keyword match for workflow ${id}: "${incomingText}" in [${tokens}]`);
              }
          }
      }

      if (isMatch) {
          console.log(`[WorkflowEvents] Triggering workflow ${id} for event ${triggerType}`);
          // For new_contact and incoming_webhook triggers, phone may be null; still execute
          const phone = phoneNumber || 'unknown';
          runWorkflow(id, phone, context).catch((err) => {
              console.error(`[WorkflowEvents] Workflow ${id} failed for event ${triggerType}: ${err.message}`);
          });
      }
    }
  } catch (err) {
    console.error(`[WorkflowEvents] Failed to trigger workflows for event ${triggerType}:`, err);
  }
}

/**
 * Called when a new contact is created.
 * Finds and runs all workflows triggered by 'new_contact'.
 */
async function triggerContactCreatedWorkflows(contactData) {
  const phoneNumber = contactData.phone || contactData.external_id || null;
  const context = {
    name: contactData.name || contactData.display_name || '',
    phone: contactData.phone || contactData.external_id || '',
    email: contactData.email || '',
    tags: Array.isArray(contactData.tags) ? contactData.tags.join(',') : (contactData.tags || ''),
    source: contactData.source || '',
    course: contactData.course || '',
    contact_id: contactData.id || contactData.contact_id || '',
  };
  console.log(`[WorkflowEvents] New contact created: ${phoneNumber}. Context:`, context);
  await triggerWorkflowsForEvent('new_contact', phoneNumber, context);
}

async function checkUserReply(phoneNumber, sinceTime) {
  if (!sinceTime) {
    console.log('[WorkflowRunner] checkUserReply: No sinceTime provided');
    return [];
  }

  try {
    console.log(`[WorkflowRunner] checkUserReply: Checking for reply from ${phoneNumber} since ${sinceTime.toISOString()}`);

    // Find contact
    let contactRes = await db.query('SELECT id, external_id FROM contacts WHERE external_id = $1', [phoneNumber]);

    // Fallback: Try with/without '+' prefix if not found
    if (contactRes.rows.length === 0) {
      const altPhone = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : `+${phoneNumber}`;
      contactRes = await db.query('SELECT id, external_id FROM contacts WHERE external_id = $1', [altPhone]);
    }

    if (contactRes.rows.length === 0) {
      console.log(`[WorkflowRunner] checkUserReply: Contact not found for ${phoneNumber}`);
      return [];
    }
    const contactId = contactRes.rows[0].id;
    console.log(`[WorkflowRunner] checkUserReply: Found contactId ${contactId}`);

    // Find conversation
    const convRes = await db.query('SELECT id FROM conversations WHERE contact_id = $1', [contactId]);
    if (convRes.rows.length === 0) {
      console.log(`[WorkflowRunner] checkUserReply: Conversation not found for contactId ${contactId}`);
      return [];
    }
    const conversationId = convRes.rows[0].id;
    console.log(`[WorkflowRunner] checkUserReply: Found conversationId ${conversationId}`);

    // Check messages
    const msgRes = await db.query(
      `SELECT id, created_at, text_body FROM messages 
       WHERE conversation_id = $1 
         AND direction = 'inbound' 
         AND created_at >= $2`,
      [conversationId, sinceTime]
    );

    console.log(`[WorkflowRunner] checkUserReply: Found ${msgRes.rowCount} messages`);
    if (msgRes.rowCount > 0) {
      console.log(`[WorkflowRunner] checkUserReply: First message: ${JSON.stringify(msgRes.rows[0])}`);
    }

    return msgRes.rows;
  } catch (err) {
    console.error('[WorkflowRunner] Error checking user reply:', err);
    return [];
  }
}

/**
 * Called when a webhook triggers a workflow.
 * Finds and runs all workflows triggered by 'incoming_webhook'.
 */
async function triggerWebhookWorkflows(payload) {
  // Extract contact info from payload
  const phone = payload.phone || payload.mobile || payload.whatsapp || payload.contact || '';
  const name = payload.name || payload.full_name || payload.username || '';
  const email = payload.email || payload.mail || '';
  
  if (!phone) {
    console.log('[WorkflowEvents] Webhook received but no phone number found in payload. Skipping workflow.');
    return;
  }

  // Normalize phone (remove + if present, ensuring lookup works)
  const normalizedPhone = String(phone).replace(/[+\s-]/g, '');

  console.log(`[WorkflowEvents] Webhook triggered for ${normalizedPhone}. Payload:`, payload);

  // Initial Context from Payload
  const initialContext = { ...payload };
  if (name) initialContext.name = name;
  if (email) initialContext.email = email;
  if (normalizedPhone) initialContext.phone = normalizedPhone;

  // Find all active workflows with 'incoming_webhook' trigger
  const res = await db.query(`
    SELECT id, steps FROM workflows 
    WHERE status = 'active' 
    AND steps->'nodes' @> '[{"type":"incoming_webhook"}]'
  `);

  console.log(`[WorkflowEvents] Found ${res.rowCount} workflows with incoming_webhook trigger.`);

  for (const wf of res.rows) {
    const nodes = wf.steps.nodes || [];
    const triggerNode = nodes.find(n => n.type === 'incoming_webhook');
    
    // Check if this specific webhook ID matches (if we support multiple webhook endpoints per workflow)
    // For now, we assume global webhook trigger or filtered by workflow ID in the route handler.
    // If the route handler calls this specific function for a specific workflow ID, we should pass it.
    
    // However, if this is a generic broadcast, we run all.
    // BUT, usually webhook URLs are unique per workflow (e.g. /webhooks/workflow/:id).
    // If so, the caller (route) should call runWorkflow directly.
    
    // Let's assume this function is for GENERIC webhooks or when we want to match payload criteria.
    // For specific workflow webhooks, the route handler calls runWorkflow(id, phone, payload).
    
    // We will still run it here for completeness if used that way.
    runWorkflow(wf.id, normalizedPhone, initialContext).catch(err => {
      console.error(`[WorkflowEvents] Failed to run workflow ${wf.id}:`, err);
    });
  }
}

async function runWorkflow(id, phoneNumber, context = {}) {
  const workflowStartTime = new Date();
  const executionLog = [];
  let io = null;
  let status = 'started';
  let hasError = false;

  // Add standardized variables to context
  context.phone = phoneNumber;
  context.mobile = phoneNumber; // Alias for mobile
  if (!context.name) context.name = 'User';

  try {
    const workflow = await getWorkflow(id);
    if (!workflow) throw new Error('Workflow not found');

    const { steps } = workflow;
    if (!steps || !steps.nodes) throw new Error('Invalid workflow definition: no steps found');

    const { nodes, edges = [] } = steps;
    
    // Find trigger node (formal)
    let currentNode = nodes.find(n => n.type === 'trigger' || n.type === 'incoming_webhook' || n.type === 'new_contact' || n.type === 'campaign_trigger');
    
    // FALLBACK: If no formal trigger but part of a Drip Sequence (or manual run), 
    // find the first "Entry Node" (no incoming edges)
    if (!currentNode && nodes.length > 0) {
      console.log(`[WorkflowRunner] No formal trigger found for workflow ${id}. Seeking entry point...`);
      const targetIds = new Set(edges.map(e => e.target));
      currentNode = nodes.find(n => !targetIds.has(n.id));
      
      if (currentNode) {
        console.log(`[WorkflowRunner] Using entry point node: ${currentNode.type} (${currentNode.id})`);
      }
    }

    if (!currentNode) {
        throw new Error('No trigger node or entry point found in workflow steps');
    }

    // Ensure contact exists or update it with new info
  try {
      // If we don't have a name in context (e.g. inbound message trigger), try to fetch it from DB
          const contactRes = await db.query('SELECT id, display_name, profile FROM contacts WHERE external_id = $1', [phoneNumber]);
          if (contactRes.rowCount > 0) {
              const row = contactRes.rows[0];
              context.contact_id = row.id;
              context.name = row.display_name || row.profile?.name || 'User';
              
              // Load attributes into context for {{variable}} resolution
              const attributes = row.profile?.attributes || {};
              if (typeof attributes === 'object') {
                Object.assign(context, attributes);
              }

              console.log(`[WorkflowRunner] Fetched contact ${context.name}. Loaded attributes: ${Object.keys(attributes).join(', ')}`);
          } else {
              // Contact doesn't exist (e.g. manual run without prior inbound msg). Create it.
              console.log(`[WorkflowRunner] Contact ${phoneNumber} not found. Creating placeholder.`);
              // We need a channel_id. Try to find a whatsapp channel.
              const chanRes = await db.query("SELECT id FROM channels WHERE type='whatsapp' LIMIT 1");
              if (chanRes.rowCount > 0) {
                  const channelId = chanRes.rows[0].id;
                  const newContact = await db.query(`
                      INSERT INTO contacts (id, channel_id, external_id, display_name, profile)
                      VALUES (gen_random_uuid(), $1, $2, 'User', '{}'::jsonb)
                      ON CONFLICT (channel_id, external_id) DO UPDATE SET updated_at = NOW()
                      RETURNING display_name
                  `, [channelId, phoneNumber]);
                  context.name = newContact.rows[0].display_name;
              } else {
                  context.name = 'User';
              }
          }
      } catch (err) {
          console.error(`[WorkflowRunner] Failed to ensure/fetch contact for ${phoneNumber}:`, err);
      }

      // If incoming_webhook has name/email, we update the contact
      if (currentNode.type === 'incoming_webhook') {
          const contactId = await ensureContact({
              external_id: phoneNumber,
              name: context.name || undefined,
              email: context.email || undefined,
              attributes: context, // Save full payload as attributes
              skipGlobalTriggers: true // CRITICAL: Avoid infinite loop or double-send if "New Contact" workflow is also active
          });
          context.contact_id = contactId;
          console.log(`[WorkflowRunner] Webhook run context prepared for contact ${contactId}.`);
      }

  // If trigger is incoming_webhook, map payload to variables
  if (currentNode.type === 'incoming_webhook') {
    const paramMapping = currentNode.data?.paramMapping || {};
    // paramMapping: { "name": "user_name", "email": "user_email" } 
    // where key is payload field, value is variable name
    
    Object.entries(paramMapping).forEach(([payloadKey, varName]) => {
      if (context[payloadKey] !== undefined) {
        context[varName] = context[payloadKey];
      }
    });

    // Also auto-map standard fields if not explicitly mapped but present
    if (!context['name'] && context['name']) context['name'] = context['name']; // already in context
    
    // Contact update already handled above
  } else if (currentNode.type === 'new_contact' || (currentNode.type === 'trigger' && currentNode.data?.triggerType === 'new_contact')) {
      const fieldMapping = currentNode.data?.fieldMapping || {};
      // Map contact fields to variables based on mapping
      // Standard fields: contact_name, contact_phone, contact_email, contact_course, contact_tags, contact_source, contact_id
      const mappingTable = [
        { key: 'contact_name', contextKey: 'name', defaultVar: 'name' },
        { key: 'contact_phone', contextKey: 'phone', defaultVar: 'phone' },
        { key: 'contact_email', contextKey: 'email', defaultVar: 'email' },
        { key: 'contact_course', contextKey: 'course', defaultVar: 'course' },
        { key: 'contact_tags', contextKey: 'tags', defaultVar: 'tags' },
        { key: 'contact_source', contextKey: 'source', defaultVar: 'source' },
        { key: 'contact_id', contextKey: 'contact_id', defaultVar: 'contact_id' }
      ];

      mappingTable.forEach(entry => {
        const varName = fieldMapping[entry.key] || entry.defaultVar;
        if (context[entry.contextKey] !== undefined) {
           context[varName] = context[entry.contextKey];
        }
      });
  }

  // Context state
  let lastTemplateSentAt = null;

  console.log(`[WorkflowRunner] Starting workflow ${id} for ${phoneNumber}`);
  console.log(`[WorkflowRunner] Context variables:`, JSON.stringify(context));
  const MAX_STEPS = 50;
  let stepCount = 0;

  try {
    const { getIO } = require('../realtime/io');
    io = getIO();
    if (io) {
      io.emit('workflow:run:start', { workflowId: id, phoneNumber, startedAt: workflowStartTime });
    }
  } catch (e) {}

  while (currentNode && stepCount < MAX_STEPS) {
    stepCount++;
    const edges = (steps && Array.isArray(steps.edges)) ? steps.edges : [];
    
    executionLog.push({
      step: stepCount,
      nodeId: currentNode.id,
      type: currentNode.type,
      status: 'started'
    });
    if (io) {
      io.emit('workflow:step:start', { workflowId: id, phoneNumber, nodeId: currentNode.id, type: currentNode.type, step: stepCount, contextPreview: buildContextPreview(context) });
    }

    try {
      // 1. Check for node-level delay (common in AI-generated flows)
      // This allows any node to have a 'wait' before it fires
      const nodeData = currentNode.data || {};
      const scheduleType = nodeData.scheduleType || nodeData.ScheduleType;
      const delayValue = nodeData.delayValue || nodeData.DelayValue || nodeData.timeValue;
      
      if (currentNode.type !== 'delay' && scheduleType === 'delay' && delayValue) {
        const val = parseInt(delayValue, 10);
        if (!isNaN(val) && val > 0) {
          const unit = (nodeData.delayUnit || nodeData.DelayUnit || 'minutes').toLowerCase();
          let ms = val * 60000;
          if (unit === 'hours') ms = val * 3600000;
          if (unit === 'days') ms = val * 86400000;
          if (unit.startsWith('sec')) ms = val * 1000;
          
          console.log(`[WorkflowRunner] Node-level delay detected on ${currentNode.id}: Waiting ${val} ${unit}...`);
          await sleep(ms);
        }
      }

      // 1. Execute Node Logic
      if (currentNode.type === 'send_template') {
        const nodeData = currentNode.data || {};
        const templateName = nodeData.template;
        if (templateName) {
          let components = Array.isArray(nodeData.components) ? JSON.parse(JSON.stringify(nodeData.components)) : [];
          const languageCode = nodeData.languageCode || 'en_US';
          
          // 0. Auto-inject header component if missing but data exists in nodeData
          const headerUrl = nodeData.headerUrl || '';
          const headerType = nodeData.headerType || 'none';
          const hasHeaderComp = components.some(c => c.type === 'header' || c.type === 'HEADER');
          
          if (!hasHeaderComp && ['image', 'video', 'document'].includes(headerType) && headerUrl) {
              console.log(`[WorkflowRunner] Auto-injecting missing ${headerType} header. URL: ${headerUrl.slice(0, 30)}...`);
              components.unshift({
                  type: 'header',
                  parameters: [{
                      type: headerType,
                      [headerType]: { link: headerUrl }
                  }]
              });
          }

          // Resolve variables in components while preserving parameter_name for NAMED templates
          components = components.map(comp => {
            if (comp.parameters && Array.isArray(comp.parameters)) {
              comp.parameters = comp.parameters.map(param => {
                const next = { ...param };
                
                // 1. Resolve text parameters
                if (param.type === 'text') {
                  next.text = param.text ? resolvePlaceholders(param.text, context) : '';
                }
                
                // 2. Resolve media parameters (image, video, document)
                if (['image', 'video', 'document'].includes(param.type)) {
                  // If it's already wrapped in a sub-object (Meta format), resolve inside it
                  if (param[param.type]) {
                    const mediaSub = { ...param[param.type] };
                    if (mediaSub.link) mediaSub.link = resolvePlaceholders(mediaSub.link, context);
                    if (mediaSub.id) mediaSub.id = resolvePlaceholders(mediaSub.id, context);
                    next[param.type] = mediaSub;
                  } 
                  // If it's flat (old format), resolve and then we'll wrap it below or just leave it for the wrapper to handle
                  else {
                    if (param.link) next.link = resolvePlaceholders(param.link, context);
                    if (param.id) next.id = resolvePlaceholders(param.id, context);
                  }
                  
                  // Wrap into Meta Cloud API format: { "type": "image", "image": { "link": "..." } }
                  if (!param[param.type]) {
                    const mediaPayload = {};
                    if (next.link) mediaPayload.link = next.link;
                    if (next.id) mediaPayload.id = next.id;
                    
                    if (Object.keys(mediaPayload).length > 0) {
                      next[param.type] = mediaPayload;
                      delete next.link;
                      delete next.id;
                    }
                  }
                }
                
                // 3. Resolve button payloads (payload type)
                if (param.type === 'payload' && param.payload) {
                   next.payload = resolvePlaceholders(param.payload, context);
                }
                
                return next;
              });
            }
            return comp;
          });

          console.log(`[WorkflowRunner] Sending template ${templateName} to ${phoneNumber}. Resolved payload:`, JSON.stringify(components, null, 2));
          // Resolve conversation and send via outbound service (persists to DB)
          try {
            const conversationId = await ensureConversation(phoneNumber);
            await outboundWhatsApp.sendTemplate(conversationId, templateName, languageCode, components);
            lastTemplateSentAt = new Date();
          } catch (err) {
            console.error(`[WorkflowRunner] Failed to send template ${templateName}: ${err.message}`);
            // Do NOT fallback and retry via direct client if it's already sent or is a hard error
            // Fallbacks often cause double-sends if the DB just failed but Meta succeeded.
            throw err; 
          }

          // Handle Quick Reply Buttons (Branching)
          if (currentNode.routes && Object.keys(currentNode.routes).length > 0) {
            console.log(`[WorkflowRunner] Waiting for user reply to match buttons: ${Object.keys(currentNode.routes).join(', ')}`);
            const pollingStart = Date.now();
            const TIMEOUT = 5 * 60 * 1000; // 5 mins wait max
            let matchedRoute = null;
            if (io) {
              io.emit('workflow:step:wait', { workflowId: id, phoneNumber, nodeId: currentNode.id, reason: 'await_reply' });
            }

            while (Date.now() - pollingStart < TIMEOUT) {
              const replies = await checkUserReply(phoneNumber, lastTemplateSentAt);
              if (replies && replies.length > 0) {
                for (const msg of replies) {
                  const text = (msg.text_body || '').trim();
                  // Find matching route key (case insensitive)
                  const matchedKey = Object.keys(currentNode.routes).find(k => k.toLowerCase() === text.toLowerCase());
                  if (matchedKey) {
                    matchedRoute = currentNode.routes[matchedKey];
                    console.log(`[WorkflowRunner] Matched reply '${text}' to route -> ${matchedRoute}`);
                    break;
                  }
                }
              }
              if (matchedRoute) break;
              await sleep(3000); // Poll every 3 seconds
            }

            if (matchedRoute) {
              currentNode = nodes.find(n => n.id === matchedRoute);
              continue; // Skip default next logic
            } else {
              console.log('[WorkflowRunner] Timed out waiting for button reply.');
              if (io) {
                io.emit('workflow:step:timeout', { workflowId: id, phoneNumber, nodeId: currentNode.id, reason: 'await_reply_timeout' });
              }
            }
          }
        }
      } else if (currentNode.type === 'send_message') {
        const text = currentNode.data.message;
        if (text) {
          console.log(`[WorkflowRunner] Sending text message to ${phoneNumber}`);
          try {
            const conversationId = await ensureConversation(phoneNumber);
            await outboundWhatsApp.sendText(conversationId, text);
          } catch (err) {
            console.error(`[WorkflowRunner] Failed to send text message: ${err.message}`);
          }
        }

      } else if (currentNode.type === 'response_message' || currentNode.type === 'feedback') {
        const isFeedback = currentNode.type === 'feedback';
        const d = currentNode.data || {};
        const text = isFeedback ? (d.question || 'Your feedback matters! Please rate this chat on scale of 1-5') : d.message;
        const buttonsData = isFeedback ? [1, 2, 3, 4, 5] : (d.buttons || []);
        const style = d.buttonStyle || 'numbers';

        const getDisplay = (val) => {
          if (!isFeedback) return val;
          if (style === 'emojis') {
            const emojis = ['😠', '🙁', '😐', '🙂', '😄'];
            return emojis[val - 1] || `${val}`;
          }
          if (style === 'stars') return `${val} ⭐`;
          return `${val}`;
        };

        const buttonLabels = buttonsData.map(v => getDisplay(v));

        try {
          const conversationId = await ensureConversation(phoneNumber);

          let interactivePayload;
          if (buttonLabels.length > 0 && buttonLabels.length <= 3) {
            interactivePayload = {
              type: 'button',
              body: { text: text },
              action: {
                buttons: buttonLabels.map((lbl, idx) => ({
                  type: 'reply',
                  reply: { id: `btn_${idx}`, title: lbl.length > 20 ? lbl.slice(0, 17) + '...' : lbl }
                }))
              }
            };
          } else if (buttonLabels.length > 3) {
            interactivePayload = {
              type: 'list',
              header: { type: 'text', text: isFeedback ? 'Feedback' : 'Select Option' },
              body: { text: resolvePlaceholders(text, context) },
              action: {
                button: isFeedback ? 'Rate' : 'Select',
                sections: [{
                  title: isFeedback ? 'Ratings' : 'Options',
                  rows: buttonLabels.map((lbl, idx) => ({
                    id: `row_${idx}`,
                    title: lbl.length > 24 ? lbl.slice(0, 21) + '...' : lbl,
                  }))
                }]
              }
            };
          } else {
            const resolvedText = resolvePlaceholders(text, context);
            await outboundWhatsApp.sendText(conversationId, resolvedText);
            interactivePayload = null;
          }

          if (interactivePayload) {
            await outboundWhatsApp.sendInteractive(conversationId, interactivePayload);
            const sentAt = new Date();

            let matchedValue = null;
            const waitStart = Date.now();
            const timeout = isFeedback ? 120000 : 300000; // 2 or 5 mins

            while (Date.now() - waitStart < timeout) {
              const replies = await checkUserReply(phoneNumber, sentAt);
              if (replies.length > 0) {
                const lastReply = replies[0].content.trim();
                for (let i = 0; i < buttonLabels.length; i++) {
                  if (lastReply.toLowerCase() === buttonLabels[i].toLowerCase() || lastReply === String(i + 1)) {
                    matchedValue = isFeedback ? (i + 1) : buttonLabels[i];
                    break;
                  }
                }
              }
              if (matchedValue !== null) break;
              if (!isFeedback && d.skipReply) break;
              await sleep(3000);
            }

            if (matchedValue !== null) {
              if (isFeedback) {
                const convRes = await db.query('SELECT contact_id FROM conversations WHERE id = $1', [conversationId]);
                const contactId = convRes.rows[0]?.contact_id;
                await db.query(`
                  INSERT INTO csat_scores (workflow_id, contact_id, conversation_id, score)
                  VALUES ($1, $2, $3, $4)
                `, [id, contactId, conversationId, matchedValue]);
              } else if (d.saveVariable) {
                const varName = d.saveVariable.replace(/[{}]/g, '');
                context[varName] = matchedValue;
                const contactRes = await db.query('SELECT id FROM contacts WHERE external_id = $1', [phoneNumber]);
                if (contactRes.rowCount > 0) {
                  await db.query(`
                    UPDATE contacts 
                    SET profile = jsonb_set(
                        COALESCE(profile, '{}'::jsonb), 
                        '{attributes}', 
                        (COALESCE(profile->'attributes', '{}'::jsonb) || jsonb_build_object($1::text, $2::text))
                    )
                    WHERE id = $3
                  `, [varName, matchedValue, contactRes.rows[0].id]);
                }
              }

              if (!isFeedback && currentNode.routes) {
                const matchedKey = Object.keys(currentNode.routes).find(k => k.toLowerCase() === String(matchedValue).toLowerCase());
                if (matchedKey) {
                  currentNode = nodes.find(n => n.id === currentNode.routes[matchedKey]);
                  continue;
                }
              }
            }
          }
        } catch (err) {
          console.error(`[WorkflowRunner] Feedback/Response node failed: ${err.message}`);
        }


      } else if (currentNode.type === 'payment_request' || currentNode.type === 'razorpay_link') {
        const d = currentNode.data || {};
        const amount = parseFloat(d.amount || '0');
        const type = d.requestType || 'course';
        const course = d.course || '';
        const webinar = d.webinarName || '';
        const papers = Array.isArray(d.papers) ? d.papers.join(', ') : '';
        const summary = d.paymentSummary || '';

        let displayTitle = (type === 'course') ? `Course: ${course}` : `Webinar: ${webinar}`;
        let messageBody = `💳 *Payment Request*\n\n`;
        if (type === 'course') {
          messageBody += `*Course:* ${course}\n`;
          if (papers) messageBody += `*Papers:* ${papers}\n`;
          if (d.packageName) messageBody += `*Package:* ${d.packageName}\n`;
        } else {
          messageBody += `*Webinar:* ${webinar}\n`;
        }
        messageBody += `*Amount:* ₹${amount}\n`;
        if (summary) messageBody += `\n*Summary:* ${summary}`;

        try {
          const conversationId = await ensureConversation(phoneNumber);
          // Fetch contact and associated teamId (via channel -> whatsapp_settings)
          const contactRes = await db.query(`
            SELECT c.id, c.external_id, c.profile, ws.team_id
            FROM contacts c
            JOIN channels ch ON ch.id = c.channel_id
            LEFT JOIN whatsapp_settings ws ON ws.phone_number_id = ch.external_id
            WHERE c.external_id = $1
            LIMIT 1
          `, [phoneNumber]);
          
          const contact = contactRes.rows[0] || {};
          const contactId = contact.id;
          const teamId = contact.team_id || 'default';

          // Generate Razorpay Link
          console.log(`[WorkflowRunner] Creating Razorpay link for ₹${amount} (Team: ${teamId})...`);
          const payLink = await razorpay.createPaymentLink({
            amount,
            description: displayTitle,
            contact: phoneNumber.replace(/\+/g, ''),
            email: contact.profile?.email || '',
            teamId, // Pass teamId for multi-tenant keys
            notes: {
              teamId, // Include in notes for webhook return
              workflow_id: id,
              contact_id: contactId,
              conversation_id: conversationId,
              request_type: type
            }
          });

          // Save to DB
          await db.query(`
            INSERT INTO payment_requests (workflow_id, contact_id, conversation_id, amount, request_type, details, status, external_reference)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
          `, [id, contactId, conversationId, amount, type, JSON.stringify(d), payLink.id]);

          // Send Interactive CTA URL Button
          const interactive = {
            type: 'cta_url',
            header: { type: 'text', text: d.headerText || 'Checkout Securely' },
            body: { text: messageBody },
            footer: { text: d.footerText || 'Click below to pay' },
            action: {
              name: 'cta_url',
              parameters: {
                display_text: d.buttonText || 'Pay Now',
                url: payLink.short_url
              }
            }
          };

          await outboundWhatsApp.sendInteractive(conversationId, interactive);
          console.log(`[WorkflowRunner] Payment request CTA sent. Link: ${payLink.short_url}`);
        } catch (err) {
          console.error(`[WorkflowRunner] Payment request node failed: ${err.message}`);
          try {
            const conversationId = await ensureConversation(phoneNumber);
            const errMsg = err.message.includes('not configured')
              ? '⚠️ Razorpay is not connected yet. Please go to *Integrations > Payments* to set up your account and come back.'
              : `⚠️ Payment link generation failed: ${err.message}`;
            await outboundWhatsApp.sendText(conversationId, errMsg);
          } catch (e) { }
        }

      } else if (currentNode.type === 'payment_reminder' || currentNode.type === 'razorpay_status') {
        const d = currentNode.data || {};
        const duration = parseInt(d.duration || '24', 10);
        const unit = d.unit || 'hours';

        let waitMs = duration * 60 * 60 * 1000; // default hours
        if (unit === 'minutes') waitMs = duration * 60 * 1000;
        if (unit === 'days') waitMs = duration * 24 * 60 * 60 * 1000;

        console.log(`[WorkflowRunner] Payment reminder: waiting ${duration} ${unit}...`);
        await sleep(waitMs);

        try {
          const conversationId = await ensureConversation(phoneNumber);
          const paymentRes = await db.query(`
            SELECT status FROM payment_requests 
            WHERE conversation_id = $1 
            ORDER BY created_at DESC LIMIT 1
          `, [conversationId]);

          const status = paymentRes.rows[0]?.status || 'unpaid';
          const branch = (status === 'paid') ? 'paid' : 'unpaid';

          if (currentNode.routes && currentNode.routes[branch]) {
            currentNode = nodes.find(n => n.id === currentNode.routes[branch]);
            continue;
          } else {
            console.log(`[WorkflowRunner] No route found for branch: ${branch}`);
          }
        } catch (err) {
          console.error(`[WorkflowRunner] Payment reminder node failed: ${err.message}`);
        }

      } else if (currentNode.type === 'campaign_condition') {
        const d = currentNode.data || {};
        const mode = d.timingMode || 'after';
        let ms = 0;

        if (mode === 'specific' && d.specificTime) {
          const target = new Date(d.specificTime).getTime();
          if (!Number.isNaN(target)) ms = target - Date.now();
        } else {
          const days = parseInt(d.checkDays || 0, 10);
          const hours = parseInt(d.checkHours || 0, 10);
          const minutes = parseInt(d.checkMinutes || 0, 10);
          ms = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
        }

        if (ms > 0) {
          console.log(`[WorkflowRunner] Campaign condition delay: waiting ${ms}ms for node ${currentNode.id}`);
          if (io) {
            io.emit('workflow:step:wait', { workflowId: id, phoneNumber, nodeId: currentNode.id, reason: 'campaign_wait', ms });
          }
          await sleep(ms);
        }

        // Proceed to evaluation logic (mocked for now, defaults to success)
        console.log(`[WorkflowRunner] Campaign condition reached for node ${currentNode.id}. Proceeding.`);
      } else if (currentNode.type === 'notification') {
        const d = currentNode.data || {};
        const message = d.message || 'Workflow notification alert';

        try {
          const { getIO } = require('../realtime/io');
          const io = getIO();
          if (io) {
            io.emit('staff:notification', {
              type: 'workflow_alert',
              title: 'Workflow Alert',
              message: message,
              phoneNumber: phoneNumber,
              workflowId: id,
              nodeId: currentNode.id
            });
            console.log(`[WorkflowRunner] Notification sent for node ${currentNode.id}`);
          }
        } catch (err) {
          console.error(`[WorkflowRunner] Notification node failed: ${err.message}`);
        }

      } else if (currentNode.type === 'custom_code') {
        console.log(`[WorkflowRunner] Executing custom code (mock): ${currentNode.data.code}`);
        // In a real system, use vm2 or isolated sandbox
      } else if (currentNode.type === 'delay') {
        const d = currentNode.data || {};
        let ms = 0;

        const mode = d.delayMode || (d.targetAt ? 'specific' : 'relative');
        if (mode === 'specific' && d.targetAt) {
          const target = new Date(d.targetAt).getTime();
          if (!Number.isNaN(target)) {
            ms = target - Date.now();
          }
        } else if (mode === 'relative' && (d.days != null || d.hours != null || d.minutes != null)) {
          const days = parseInt(d.days || 0, 10);
          const hours = parseInt(d.hours || 0, 10);
          const minutes = parseInt(d.minutes || 0, 10);
          ms = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
        } else {
          const duration = parseInt(d.duration || 0, 10);
          const unit = d.unit || 'minutes';

          if (unit === 'seconds') ms = duration * 1000;
          else if (unit === 'minutes') ms = duration * 60 * 1000;
          else if (unit === 'hours') ms = duration * 60 * 60 * 1000;
          else if (unit === 'days') ms = duration * 24 * 60 * 60 * 1000;
        }

        if (!Number.isFinite(ms)) ms = 0;
        if (ms < 0) ms = 0;

        console.log(`[WorkflowRunner] Waiting ${ms}ms (delay node)`);
        if (io) {
          io.emit('workflow:step:wait', { workflowId: id, phoneNumber, nodeId: currentNode.id, reason: 'delay', ms });
        }
        if (ms > 0) await sleep(ms);
      } else if (currentNode.type === 'attribute_condition') {
        let attrs = {};
        try {
          const conversationId = await ensureConversation(phoneNumber);
          const res = await db.query(`
            SELECT c.profile->'attributes' AS attrs
            FROM conversations v
            JOIN contacts c ON c.id = v.contact_id
            WHERE v.id = $1
          `, [conversationId]);
          attrs = res.rows[0]?.attrs || {};
        } catch (e) {}
        attrs = { ...(attrs || {}), ...(context || {}) };

        const groups = Array.isArray(currentNode.data?.groups) ? currentNode.data.groups : [];
        const normalize = (v) => {
          if (v == null) return '';
          if (typeof v === 'string') return v;
          if (typeof v === 'number' || typeof v === 'boolean') return String(v);
          return JSON.stringify(v);
        };
        const cmp = (leftRaw, op, rightRaw) => {
          const left = normalize(leftRaw);
          const right = normalize(rightRaw);
          const li = left.toLowerCase();
          const ri = right.toLowerCase();
          if (op === 'eq') return left === right;
          if (op === 'neq') return left !== right;
          if (op === 'gt') return parseFloat(left) > parseFloat(right);
          if (op === 'lt') return parseFloat(left) < parseFloat(right);
          if (op === 'contains') return li.includes(ri);
          if (op === 'not_contains') return !li.includes(ri);
          if (op === 'starts_with') return li.startsWith(ri);
          if (op === 'ends_with') return li.endsWith(ri);
          return false;
        };

        let matchedRoute = null;
        for (let gi = 0; gi < groups.length; gi++) {
          const g = groups[gi];
          const clauses = Array.isArray(g.clauses) ? g.clauses : [];
          let acc = null;
          for (let ci = 0; ci < clauses.length; ci++) {
            const cl = clauses[ci];
            const key = cl.key || '';
            const op = cl.op || 'eq';
            const val = cl.value || '';
            const left = attrs?.[key];
            const res = cmp(left, op, val);
            if (acc === null) acc = res;
            else {
              const join = (clauses[ci - 1]?.join || 'AND').toUpperCase();
              if (join === 'OR') acc = acc || res;
              else acc = acc && res;
            }
          }
          if (acc) {
            matchedRoute = currentNode.routes && currentNode.routes[`group-${gi}`];
            break;
          }
        }
        if (!matchedRoute) {
          matchedRoute = currentNode.routes && currentNode.routes['default'];
        }
        if (matchedRoute) {
          currentNode = nodes.find((n) => n.id === matchedRoute);
          continue;
        }
      } else if (currentNode.type === 'action') {
        const actionType = currentNode.data.actionType;
        const actionValue = currentNode.data.actionValue;
        console.log(`[WorkflowRunner] Executing action: ${actionType} = ${actionValue}`);

        try {
          const conversationId = await ensureConversation(phoneNumber);

          if (actionType === 'add_tag') {
            const convRes = await db.query('SELECT contact_id FROM conversations WHERE id = $1', [conversationId]);
            if (convRes.rowCount > 0) {
              const contactId = convRes.rows[0].contact_id;
              await db.query(`
                        UPDATE contacts 
                        SET profile = jsonb_set(
                            COALESCE(profile, '{}'::jsonb), 
                            '{tags}', 
                            (
                              (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                               FROM jsonb_array_elements(COALESCE(profile->'tags', '[]'::jsonb)) elem
                               WHERE elem::text <> to_jsonb($1::text)::text)
                              || to_jsonb($1::text)
                            )
                        )
                        WHERE id = $2
                    `, [actionValue, contactId]);
            }
            try {
              triggerWorkflowsForEvent('tag_added', phoneNumber, { tag: actionValue }, id);
            } catch (e) {
              console.error(
                `[WorkflowRunner] Failed to trigger tag_added workflows: ${e.message}`
              );
            }
          } else if (actionType === 'add_to_label') {
            const convRes = await db.query('SELECT contact_id FROM conversations WHERE id = $1', [conversationId]);
            if (convRes.rowCount > 0) {
              const contactId = convRes.rows[0].contact_id;
              const labelId = actionValue;
              if (labelId) {
                await db.query(
                  `INSERT INTO contact_label_maps (label_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                  [labelId, contactId]
                );
              }
            }
          } else if (actionType === 'send_email') {
            const templateId = currentNode.data.emailTemplateId || actionValue;
            const toVarKey = currentNode.data.toVarKey || 'email';
            const variableMapping = currentNode.data.variableMapping || {};

            let contactName = '';
            let baseAttrs = {};
            try {
              const convRes = await db.query('SELECT contact_id FROM conversations WHERE id = $1', [conversationId]);
              const contactId = convRes.rows[0]?.contact_id;
              if (contactId) {
                const contactRes = await db.query(
                  `SELECT display_name, profile FROM contacts WHERE id = $1`,
                  [contactId]
                );
                contactName = contactRes.rows[0]?.display_name || '';
                baseAttrs = contactRes.rows[0]?.profile?.attributes || {};
                if (!baseAttrs || typeof baseAttrs !== 'object') baseAttrs = {};
                if (contactRes.rows[0]?.profile?.email && !baseAttrs.email) {
                  baseAttrs.email = contactRes.rows[0].profile.email;
                }
              }
            } catch (e) {
              baseAttrs = {};
            }

            const localContext = { ...(baseAttrs || {}), ...(context || {}) };

            Object.entries(variableMapping || {}).forEach(([tplVar, srcVar]) => {
              const key = String(srcVar || '').replace(/[{}]/g, '').trim();
              if (!tplVar) return;
              if (!key) return;
              if (Object.prototype.hasOwnProperty.call(localContext, key)) {
                localContext[tplVar] = localContext[key];
              }
            });

            const toKey = String(toVarKey || '').replace(/[{}]/g, '').trim();
            const toEmail = localContext[toKey] || localContext.email || baseAttrs.email || '';
            if (!toEmail) {
              console.log('[WorkflowRunner] send_email skipped: no recipient email found');
            } else if (!templateId) {
              console.log('[WorkflowRunner] send_email skipped: no emailTemplateId configured');
            } else {
              const tmplRes = await db.query(
                `SELECT id, name, subject, html_body, text_body, variables FROM email_templates WHERE id = $1`,
                [templateId]
              );
              if (tmplRes.rowCount === 0) {
                console.log('[WorkflowRunner] send_email skipped: template not found');
              } else {
                const tmpl = tmplRes.rows[0];
                const subject = resolvePlaceholders(String(tmpl.subject || ''), localContext);
                const htmlbody = resolvePlaceholders(String(tmpl.html_body || ''), localContext);
                const textbody = resolvePlaceholders(String(tmpl.text_body || ''), localContext);
                await zeptoMail.sendEmail({
                  toEmail: String(toEmail),
                  toName: contactName ? String(contactName) : undefined,
                  subject,
                  htmlbody: htmlbody || undefined,
                  textbody: textbody || undefined,
                });
              }
            }
          } else if (actionType === 'update_lead_stage') {
            const stageId = actionValue;
            if (!stageId) {
              console.log('[WorkflowRunner] update_lead_stage skipped: no stage id');
            } else {
              await db.query('UPDATE conversations SET lead_stage_id = $1 WHERE id = $2', [stageId, conversationId]);
              console.log(`[WorkflowRunner] Updated lead stage to ${stageId}. Triggering sequence...`);
              // Trigger sequestration for the new stage (background)
              runStageWorkflows(stageId, phoneNumber).catch(e => console.error('[WorkflowRunner] Drip sequence failed:', e.message));
            }
          } else if (actionType === 'send_sms_otp') {
            const digits = parseInt(currentNode.data.otpDigits || currentNode.data.digits || 6, 10);
            const saveVarRaw = currentNode.data.saveVariable || 'otp';
            const saveVar = String(saveVarRaw).replace(/[{}]/g, '').trim() || 'otp';
            const otp = fast2sms.generateOtp(Number.isFinite(digits) ? digits : 6);
            context[saveVar] = otp;
            await fast2sms.sendOtpSms({ phoneNumber, otp });
          } else if (actionType === 'remove_tag') {
            const convRes = await db.query('SELECT contact_id FROM conversations WHERE id = $1', [conversationId]);
            if (convRes.rowCount > 0) {
              const contactId = convRes.rows[0].contact_id;
              // Remove tag from profile.tags array
              await db.query(`
                        UPDATE contacts 
                        SET profile = jsonb_set(
                            COALESCE(profile, '{}'::jsonb), 
                            '{tags}', 
                            (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                             FROM jsonb_array_elements(COALESCE(profile->'tags', '[]'::jsonb)) elem
                             WHERE elem::text <> to_jsonb($1::text)::text)
                        )
                        WHERE id = $2
                    `, [actionValue, contactId]);
            }
          } else if (actionType === 'set_variable') {
            const convRes = await db.query('SELECT contact_id FROM conversations WHERE id = $1', [conversationId]);
            if (convRes.rowCount > 0) {
              const contactId = convRes.rows[0].contact_id;
              const varName = currentNode.data.variableName;
              const varValue = currentNode.data.variableValue; // stored as string or whatever

              if (varName) {
                // Store in profile.attributes
                await db.query(`
                            UPDATE contacts 
                            SET profile = jsonb_set(
                                COALESCE(profile, '{}'::jsonb), 
                                '{attributes}', 
                                (COALESCE(profile->'attributes', '{}'::jsonb) || jsonb_build_object($1::text, $2::text))
                            )
                            WHERE id = $3
                        `, [varName, varValue, contactId]);
              }
            }
          } else if (actionType === 'assign_agent' || actionType === 'assign_agent_xolox') {
            let assignedUserId = null;
            let teamId = null;

            // 1. Resolve potential dynamic variables (e.g. {{xolox_response.assignedTo}})
            let resolvedValue = typeof actionValue === 'string' 
              ? resolvePlaceholders(actionValue, context).trim() 
              : actionValue;

            // 2. Smart Fallback: If no explicit value provided, try to extract assigned agent from Xolox response
            if ((!resolvedValue || resolvedValue === 'null' || resolvedValue === 'undefined' || resolvedValue === null)) {
                const xr = context.xolox_response || context.xolox_event_response; // check both potential keys
                if (xr) {
                  const leadData = xr.data || xr; // Handle both {data: {assignedTo}} and {assignedTo}
                  const assignedTo = leadData.assignedTo || leadData.assignedId || leadData.counselorId || leadData.assigned_id;
                  
                  if (assignedTo) {
                      if (typeof assignedTo === 'object') {
                          resolvedValue = assignedTo.id || assignedTo._id || assignedTo.value;
                      } else {
                          resolvedValue = assignedTo;
                      }
                      console.log(`[WorkflowRunner] Auto-resolving agent from Starforze/Xolox response: ${resolvedValue}`);
                  }

                  // Also try to capture teamId from response if available
                  if (!teamId) {
                      teamId = leadData.teamId || leadData.team_id || null;
                  }

                  // Linking: Use lead ID from response if available
                  const leadId = leadData.leadId || leadData.lead_id || (leadData.lead && (leadData.lead._id || leadData.lead.id));
                  if (leadId) {
                      await db.query('UPDATE conversations SET lead_id = $1 WHERE id = $2', [leadId, conversationId]);
                      console.log(`[WorkflowRunner] Linked lead ${leadId} from Starforze response to conversation ${conversationId}`);
                  }
                }
            }

            console.log(`[WorkflowRunner] Assigning agent. Target: ${JSON.stringify(resolvedValue)}`);

            // Check if actionValue is a conditions object (Round Robin) or direct email/id assignment
            let conditions = {};
            if (typeof resolvedValue === 'object' && resolvedValue !== null) {
                 conditions = resolvedValue;
            } else if (typeof resolvedValue === 'string' && resolvedValue.startsWith('{')) {
                 try { conditions = JSON.parse(resolvedValue); } catch (e) {}
            }

            if (Object.keys(conditions).length > 0) {
                // Round Robin Assignment based on conditions
                console.log(`[WorkflowRunner] Attempting Round Robin assignment with conditions:`, conditions);
                assignedUserId = await findAgentForAssignment(conditions);
                if (assignedUserId) {
                     // Get team
                     const teamRes = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [assignedUserId]);
                     teamId = teamRes.rows[0]?.team_id;
                }
            } else if (resolvedValue) {
                // Direct Email or ID Assignment
                // Try looking up by ID, email, or a potential custom agent_id in attributes
                const query = `
                  SELECT id FROM users 
                  WHERE id::text = $1 
                     OR email = $1 
                     OR attributes->>'agent_id' = $1 
                     OR attributes->>'starforze_id' = $1
                     OR attributes->>'external_id' = $1
                  LIMIT 1
                `;
                
                const userRes = await db.query(query, [resolvedValue]);
                if (userRes.rowCount > 0) {
                  assignedUserId = userRes.rows[0].id;
                  const teamRes = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [assignedUserId]);
                  teamId = teamRes.rows[0]?.team_id;
                } else {
                  console.log(`[WorkflowRunner] User ${resolvedValue} not found in our database`);
                }
            }

            if (assignedUserId) {
                // Check for existing active assignment
                const existing = await db.query(
                  'SELECT id FROM conversation_assignments WHERE conversation_id = $1 AND released_at IS NULL',
                  [conversationId]
                );

                if (existing.rowCount > 0) {
                  // Update existing
                  await db.query(`
                                UPDATE conversation_assignments
                                SET assignee_user_id = $1, team_id = $2, claimed_at = NOW()
                                WHERE id = $3
                            `, [assignedUserId, teamId, existing.rows[0].id]);
                } else {
                  // Insert new
                  await db.query(`
                                INSERT INTO conversation_assignments (conversation_id, team_id, assignee_user_id, claimed_at)
                                VALUES ($1, $2, $3, NOW())
                            `, [conversationId, teamId, assignedUserId]);
                }
                console.log(`[WorkflowRunner] Assigned conversation to user ${assignedUserId}`);
            } else if (resolvedValue && context.xolox_response) {
                // LAST CHANCE: If user not found in DB but we have their full info in the Xolox response, 
                // we can auto-provision them so assignment succeeds.
                const xr = context.xolox_response;
                const leadData = xr.data || xr;
                const assignedTo = leadData.assignedTo;

                if (assignedTo && typeof assignedTo === 'object' && (assignedTo._id || assignedTo.id) === resolvedValue) {
                    const userId = assignedTo._id || assignedTo.id;
                    const email = assignedTo.email || '';
                    const name = `${assignedTo.firstname || ''} ${assignedTo.lastname || ''}`.trim() || assignedTo.name || 'Unknown Agent';
                    
                    if (userId && email) {
                        console.log(`[WorkflowRunner] Auto-provisioning agent ${name} (${userId}) from Starforze response...`);
                        await db.query(`
                            INSERT INTO users (id, email, name, role, active, created_at)
                            VALUES ($1, $2, $3, 'agent', true, NOW())
                            ON CONFLICT (id) DO UPDATE SET
                                email = EXCLUDED.email,
                                name = EXCLUDED.name
                        `, [userId, email, name]);

                        // Now retry assignment logic with the newly created user
                        const retryTeamRes = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [userId]);
                        const finalTeamId = teamId || retryTeamRes.rows[0]?.team_id || null;

                        await db.query(`
                            INSERT INTO conversation_assignments (conversation_id, team_id, assignee_user_id, claimed_at)
                            VALUES ($1, $2, $3, NOW())
                            ON CONFLICT (conversation_id) WHERE released_at IS NULL DO UPDATE SET
                                assignee_user_id = EXCLUDED.assignee_user_id,
                                team_id = EXCLUDED.team_id,
                                claimed_at = NOW()
                        `, [conversationId, finalTeamId, userId]);
                        
                        console.log(`[WorkflowRunner] Successfully auto-provisioned and assigned agent ${userId}`);
                    }
                }
            }
          } else if (actionType === 'update_chat_status') {
            const newStatus = actionValue; // 'closed', 'open', 'snoozed'
            if (['open', 'closed', 'snoozed'].includes(newStatus)) {
              await db.query('UPDATE conversations SET status = $1 WHERE id = $2', [newStatus, conversationId]);
              console.log(`[WorkflowRunner] Updated chat status to ${newStatus}`);
            }
          } else if (actionType === 'update_lead_status') {
            const newStatus = actionValue; // 'new', 'interested', etc.
            await db.query(`
              UPDATE contacts 
              SET lead_status = $1 
              WHERE id = (SELECT contact_id FROM conversations WHERE id = $2)
            `, [newStatus, conversationId]);
            console.log(`[WorkflowRunner] Updated lead status to ${newStatus}`);
          } else if (actionType === 'update_lead_stage') {
            const stageValue = actionValue;
            if (stageValue) {
              await db.query(`
                UPDATE contacts 
                SET lead_stage = $1 
                WHERE id = (SELECT contact_id FROM conversations WHERE id = $2)
              `, [stageValue, conversationId]);
              console.log(`[WorkflowRunner] Updated lead stage to ${stageValue}`);
              // Note: runStageWorkflows might need updating to handle the new stage string logic
              // but we'll focus on the data update first.
            }
          } else if (actionType === 'start_workflow') {
            const targetId = actionValue;
            if (!targetId) {
              console.log('[WorkflowRunner] start_workflow action has no target id');
            } else if (String(targetId) === String(id)) {
              console.log('[WorkflowRunner] Skipping start_workflow to same workflow id');
            } else {
              console.log(`[WorkflowRunner] Starting linked workflow ${targetId} for ${phoneNumber}`);
              runWorkflow(targetId, phoneNumber).catch((err) => {
                console.error(`[WorkflowRunner] Linked workflow ${targetId} failed: ${err.message}`);
              });
            }
          }
        } catch (err) {
          console.error(`[WorkflowRunner] Action failed: ${err.message}`);
          if (io) {
            io.emit('workflow:step:error', { workflowId: id, phoneNumber, nodeId: currentNode.id, message: err.message || 'Action failed' });
          }
        }
      } else if (currentNode.type === 'xolox_event') {
        // ── XOLOX CRM webhook call ──────────────────────────────────────────
        const xd = currentNode.data || {};
        const webhookUrl = xd.webhookUrl;
        const method = (xd.method || 'POST').toUpperCase();
        const payloadFields = Array.isArray(xd.payloadFields) ? xd.payloadFields : [];
        const successCondition = xd.successCondition || 'status_2xx';

        if (!webhookUrl) {
          console.warn(`[WorkflowRunner] xolox_event node ${currentNode.id} has no webhookUrl — skipping`);
        } else {
          // Build payload by resolving {{variable}} placeholders against context
          const payload = {};
          for (const { field, variable } of payloadFields) {
            if (field) {
              payload[field] = resolvePlaceholders(variable || '', context);
            }
          }
          console.log(`[WorkflowRunner] Calling XOLOX webhook ${method} ${webhookUrl} with payload:`, payload);

          let xoloxSuccess = false;
          try {
            const axiosConfig = {
              method,
              url: webhookUrl,
              timeout: 15000,
              headers: { 'Content-Type': 'application/json' },
            };
            if (method === 'GET') {
              axiosConfig.params = payload;
            } else {
              axiosConfig.data = payload;
            }
            const xoloxRes = await axios(axiosConfig);
            console.log(`[WorkflowRunner] XOLOX response status: ${xoloxRes.status}`);
            const responseBody = xoloxRes.data || {};

            if (successCondition === 'status_2xx') {
              xoloxSuccess = xoloxRes.status >= 200 && xoloxRes.status < 300;
            } else if (successCondition === 'field_true') {
              const fieldKey = xd.successField || '';
              const expectedValue = String(xd.successValue || 'true');
              const actualValue = String(responseBody[fieldKey] ?? '');
              xoloxSuccess = actualValue === expectedValue;
              console.log(`[WorkflowRunner] XOLOX field check: ${fieldKey}=${actualValue} vs expected=${expectedValue} => ${xoloxSuccess}`);
            }
            
            // Store response in context so user can see it or use it
            context.xolox_response = responseBody;
          } catch (xoloxErr) {
            console.error(`[WorkflowRunner] XOLOX webhook call failed: ${xoloxErr.message}`);
            xoloxSuccess = false;
            context.xolox_error = xoloxErr.message;
            if (xoloxErr.response) {
               context.xolox_response = xoloxErr.response.data;
            }
          }

          console.log(`[WorkflowRunner] XOLOX event result: ${xoloxSuccess ? 'SUCCESS' : 'FAIL'}`);
          context.xolox_success = xoloxSuccess ? 'true' : 'false';

          // Emit transition event for UI tracking
          let nextId = xoloxSuccess ? currentNode.onSuccess : currentNode.onFail;
          if (!nextId) {
              const h = xoloxSuccess ? 'success' : 'fail';
              const edge = edges.find(e => e.source === currentNode.id && (e.sourceHandle === h || e.sourceHandle === `on${h.charAt(0).toUpperCase() + h.slice(1)}`));
              if (edge) nextId = edge.target;
          }

          if (io && nextId) {
            io.emit('workflow:step:transition', { 
              workflowId: id, 
              phoneNumber, 
              fromNodeId: currentNode.id, 
              toNodeId: nextId, 
              contextPreview: buildContextPreview(context),
              xoloxResponse: context.xolox_response // Add explicit response for UI
            });
          }
          
          currentNode = nextId ? nodes.find(n => n.id === nextId) : null;
          continue; // Skip the standard next-node logic below
        }
      }

      // 2. Move to Next Node
      let nextNodeId = null;

      if (currentNode.type === 'condition') {
        const conditionType = currentNode.data.conditionType || 'user_replied';
        console.log(`[WorkflowRunner] Evaluating condition type: ${conditionType}`);

        let result = false;

        if (conditionType === 'user_replied') {
          // Default to checking if user replied
          // Use lastTemplateSentAt if available, else workflowStartTime
          const since = lastTemplateSentAt || workflowStartTime;
          const replies = await checkUserReply(phoneNumber, since);
          result = replies.length > 0;
        } else if (conditionType === 'has_tag') {
          const tagName = currentNode.data.tagName;
          if (tagName) {
            // Check if contact has tag
            const contactRes = await db.query('SELECT profile FROM contacts WHERE external_id = $1', [phoneNumber]);
            if (contactRes.rowCount > 0) {
              const profile = contactRes.rows[0].profile || {};
              const tags = profile.tags || [];
              // tags is array of strings in JSON
              result = Array.isArray(tags) && tags.includes(tagName);
            } else {
              // Try with/without +
              const altPhone = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : `+${phoneNumber}`;
              const altRes = await db.query('SELECT profile FROM contacts WHERE external_id = $1', [altPhone]);
              if (altRes.rowCount > 0) {
                const profile = altRes.rows[0].profile || {};
                const tags = profile.tags || [];
                result = Array.isArray(tags) && tags.includes(tagName);
              }
            }
          }
        } else if (conditionType === 'variable_match') {
          const varName = currentNode.data.variableName;
          const varValue = currentNode.data.variableValue;

          if (varName) {
            // Check if contact has variable matching value
            const contactRes = await db.query('SELECT profile FROM contacts WHERE external_id = $1', [phoneNumber]);
            if (contactRes.rowCount > 0) {
              const profile = contactRes.rows[0].profile || {};
              const attributes = profile.attributes || {};
              result = attributes[varName] == varValue; // loose equality for string/number match
            } else {
              const altPhone = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : `+${phoneNumber}`;
              const altRes = await db.query('SELECT profile FROM contacts WHERE external_id = $1', [altPhone]);
              if (altRes.rowCount > 0) {
                const profile = altRes.rows[0].profile || {};
                const attributes = profile.attributes || {};
                result = attributes[varName] == varValue;
              }
            }
          }
        }

        console.log(`[WorkflowRunner] Condition result: ${result ? 'YES' : 'NO'}`);

        nextNodeId = result ? currentNode.yes : currentNode.no;
        if (!nextNodeId) {
            const h = result ? 'yes' : 'no';
            const edge = edges.find(e => e.source === currentNode.id && e.sourceHandle === h);
            if (edge) nextNodeId = edge.target;
        }

        if (io && nextNodeId) {
          io.emit('workflow:step:transition', { workflowId: id, phoneNumber, fromNodeId: currentNode.id, toNodeId: nextNodeId, contextPreview: buildContextPreview(context) });
        }
        currentNode = nextNodeId ? nodes.find(n => n.id === nextNodeId) : null;
      } else if (currentNode.type === 'end') {
        currentNode = null;
      } else {
        nextNodeId = currentNode.next;
        if (!nextNodeId) {
            const edge = edges.find(e => e.source === currentNode.id && (!e.sourceHandle || e.sourceHandle === 'default' || e.sourceHandle === 'next'));
            if (edge) nextNodeId = edge.target;
        }

        if (io && nextNodeId) {
          io.emit('workflow:step:transition', { workflowId: id, phoneNumber, fromNodeId: currentNode.id, toNodeId: nextNodeId, contextPreview: buildContextPreview(context) });
        }
        currentNode = nextNodeId ? nodes.find(n => n.id === nextNodeId) : null;
      }
      if (io) {
        const last = executionLog[executionLog.length - 1];
        io.emit('workflow:step:complete', { workflowId: id, phoneNumber, nodeId: last?.nodeId, contextPreview: buildContextPreview(context) });
      }

    } catch (err) {
      console.error(`[WorkflowRunner] Error at node ${currentNode.id}:`, err);
      
      // Update last execution log entry with error details
      const lastIdx = executionLog.length - 1;
      if (lastIdx >= 0 && executionLog[lastIdx].nodeId === currentNode.id) {
          executionLog[lastIdx].status = 'failed';
          executionLog[lastIdx].error = err.message;
          
          // Provide specialized hints for Meta API errors
          if (err.message.includes('132012')) {
              executionLog[lastIdx].details = "HINT: Template parameters didn't match. This often happens when (1) the template expects a Media Header (Image/Doc/Video) which was missing or improperly formatted, or (2) the number of variables mapped doesn't match the template's placeholders. ACTION: Try re-selecting the template in the workflow node to refresh the variable list, and ensure the 'Header' section is configured if your template has one.";
          } else if (err.message.includes('131030')) {
              executionLog[lastIdx].details = "HINT: Out of 24h service window. You can only send basic text/media if the user replied in the last 24h. Use a Template instead.";
          }
      } else {
          executionLog.push({ 
            nodeId: currentNode.id, 
            type: currentNode.type, 
            status: 'failed',
            error: err.message 
          });
      }

      if (io) {
        io.emit('workflow:step:error', { workflowId: id, phoneNumber, nodeId: currentNode.id, message: err.message || 'Node failed' });
      }
      // Stop execution on error
      break;
    }
  }

  } catch (err) {
    console.error(`[WorkflowRunner] Fatal error in workflow ${id}:`, err);
    executionLog.push({ error: err.message || 'Fatal error' });
    if (io) {
      io.emit('workflow:step:error', { workflowId: id, phoneNumber, message: err.message || 'Workflow crashed' });
    }
  } finally {
    const endedAt = new Date();
    const durationMs = endedAt.getTime() - workflowStartTime.getTime();
    hasError = executionLog.some(l => l.error);
    status = hasError ? 'failed' : 'success';

    // Persist run to database for reporting
    try {
      await db.query(`
        INSERT INTO workflow_runs (
          workflow_id, phone_number, status, execution_log, 
          context_preview, error_message, started_at, ended_at, duration_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        id, phoneNumber, status, JSON.stringify(executionLog),
        JSON.stringify(buildContextPreview(context)), hasError ? executionLog.find(l => l.error)?.error : null,
        workflowStartTime, endedAt, durationMs
      ]);
    } catch (dbErr) {
      console.error('[WorkflowRunner] Failed to persist workflow run:', dbErr.message);
    }

    if (io) {
      io.emit('workflow:run:complete', { workflowId: id, phoneNumber, endedAt, steps: executionLog.length });
    }
  }

  return { success: !hasError, log: executionLog };
}

async function getTemplateSummariesForAI() {
  if (!WABA_ID) return [];
  let templates;
  try {
    const resp = await whatsappClient.getTemplates(WABA_ID, 50);
    templates = (resp.data && resp.data.data) || [];
  } catch (err) {
    console.warn(
      '[getTemplateSummariesForAI] Failed to fetch templates:',
      err.response && err.response.status,
      err.response && err.response.data ? err.response.data : err.message
    );
    return [];
  }
  return templates
    .filter((t) => t && t.name)
    .map((t) => {
      const components = Array.isArray(t.components) ? t.components : [];
      const bodyComp = components.find((c) => c && c.type === 'BODY');
      let body = bodyComp && bodyComp.text ? String(bodyComp.text) : '';
      if (body.length > 160) {
        body = body.slice(0, 157) + '...';
      }
      return {
        name: t.name,
        category: t.category || '',
        language: t.language || t.language_code || 'en_US',
        body,
      };
    });
}

async function generateWorkflowFromDescription(description) {
  if (!description || typeof description !== 'string') {
    const e = new Error('Description is empty');
    e.status = 400;
    e.expose = true;
    throw e;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return await buildWorkflowFromSimpleDescription(description);
  }

  const systemPrompt =
    'You are an assistant that designs WhatsApp workflow automations.\n' +
    'You receive available WhatsApp templates and a high-level goal.\n' +
    'Return only strict JSON with this shape:\n' +
    '{ "steps": [ { "kind": "send_template" | "send_message", "template_name"?: string, "language_code"?: string, "text"?: string, "schedule": { "type": "immediate" | "delay", "value"?: number, "unit"?: "minutes" | "hours" | "days" } } ] }\n' +
    'If the user clearly mentions a specific existing template by name (or very close variant), prefer that exact template_name over others.\n' +
    'Otherwise, choose templates that best match the goal from the provided list.\n' +
    'If a template is clearly appropriate, prefer kind "send_template" with template_name set to its exact name.\n' +
    'Use schedule.type="delay" with value and unit when spacing messages over time (for example, after 1 day).\n' +
    'If no template fits, use kind "send_message" with free-form text.\n' +
    'Do not include a trigger step; it is implicit. Do not include any extra fields or explanations.';

  let templateSummaries = [];
  try {
    templateSummaries = await getTemplateSummariesForAI();
  } catch (err) {
    console.warn('[generateWorkflowFromDescription] Failed to load template summaries:', err.message);
  }

  const templatesText =
    templateSummaries.length > 0
      ? 'Available templates:\n' +
      templateSummaries
        .map(
          (t) =>
            `- ${t.name} [${t.language}] (${t.category || 'general'}): ${t.body || ''}`
        )
        .join('\n')
      : 'No template metadata could be loaded. If the user mentions a template by name, you may still reference it by that name in template_name.';

  const userPrompt =
    templatesText +
    '\n\nUser goal description:\n' +
    description;

  let content;
  try {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );
    content =
      resp.data &&
      resp.data.choices &&
      resp.data.choices[0] &&
      resp.data.choices[0].message &&
      resp.data.choices[0].message.content;
  } catch (err) {
    console.error(
      '[generateWorkflowFromDescription] OpenAI call failed:',
      err.response && err.response.status,
      err.response && err.response.data ? err.response.data : err.message
    );
    return await buildWorkflowFromSimpleDescription(description);
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return await buildWorkflowFromSimpleDescription(description);
  }

  const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
  if (!steps.length) {
    return await buildWorkflowFromSimpleDescription(description);
  }

  const nodes = [];
  const edges = [];

  const triggerId = `node_trigger_${Date.now()}`;
  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: 0, y: 0 },
    data: { label: 'Start Workflow' },
  });

  let prevId = triggerId;
  let y = 140;
  let index = 0;

  for (const step of steps) {
    index += 1;
    const id = `node_${Date.now()}_${index}`;
    const schedule = step.schedule || {};
    const scheduleType = (schedule && schedule.type === 'delay') ? 'delay' : 'immediate';
    const rawVal = schedule && schedule.value;
    const delayValue =
      scheduleType === 'delay' && rawVal != null
        ? (typeof rawVal === 'number' ? rawVal : parseInt(rawVal, 10))
        : null;
    const delayUnit =
      scheduleType === 'delay' && typeof (schedule && schedule.unit) === 'string'
        ? schedule.unit
        : null;

    if (step.kind === 'send_template') {
      nodes.push({
        id,
        type: 'send_template',
        position: { x: 0, y },
        data: {
          label: step.template_name || 'Send Template',
          template: step.template_name || '',
          languageCode: step.language_code || 'en_US',
          scheduleType,
          delayValue,
          delayUnit,
        },
      });
    } else if (step.kind === 'send_message') {
      nodes.push({
        id,
        type: 'send_message',
        position: { x: 0, y },
        data: {
          label: step.text || 'Send Message',
          message: step.text || '',
          scheduleType,
          delayValue,
          delayUnit,
        },
      });
    } else {
      index -= 1;
      continue;
    }

    edges.push({
      id: `e_${prevId}_${id}`,
      source: prevId,
      target: id,
    });

    prevId = id;
    y += 140;
  }

  return { nodes, edges };
}

async function resolveTemplateNameFromDescription(description) {
  if (!WABA_ID) return null;
  const trimmed = (description || '').trim();
  if (!trimmed) return null;

  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[_\-]+/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normDesc = normalize(trimmed);
  if (!normDesc) return null;

  let templates;
  try {
    const resp = await whatsappClient.getTemplates(WABA_ID, 50);
    templates = (resp.data && resp.data.data) || [];
  } catch (err) {
    console.warn(
      '[resolveTemplateNameFromDescription] Failed to fetch templates:',
      err.response && err.response.status,
      err.response && err.response.data ? err.response.data : err.message
    );
    return null;
  }

  let best = { name: null, score: 0 };

  for (const t of templates) {
    if (!t || !t.name) continue;
    const normName = normalize(t.name);
    if (!normName) continue;

    if (normDesc.includes(normName)) {
      const score = normName.length / normDesc.length;
      if (score > best.score) {
        best = { name: t.name, score };
      }
      continue;
    }

    const nameTokens = normName.split(' ');
    let hits = 0;
    for (const tok of nameTokens) {
      if (tok && normDesc.includes(tok)) hits += 1;
    }
    if (!hits) continue;
    const score = hits / nameTokens.length;
    if (score > best.score) {
      best = { name: t.name, score };
    }
  }

  if (best.name && best.score >= 0.5) {
    return best.name;
  }
  return null;
}

async function buildWorkflowFromSimpleDescription(description) {
  if (!description || typeof description !== 'string') {
    const e = new Error('Description is empty');
    e.status = 400;
    e.expose = true;
    throw e;
  }

  const lower = description.toLowerCase();

  let templateName = await resolveTemplateNameFromDescription(description);
  if (!templateName) {
    const quotedTemplateMatch = description.match(/template(?:d)? named ["']([^"']+)["']/i);
    if (quotedTemplateMatch) {
      templateName = quotedTemplateMatch[1];
    } else {
      const wordTemplateMatch = lower.match(/template(?:d)? named\s+([a-z0-9_]+)/i);
      if (wordTemplateMatch) {
        templateName = wordTemplateMatch[1];
      }
    }
  }

  let delayValue = 0;
  let delayUnit = null;
  const delayMatch = lower.match(
    /after\s+(?<value>\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?<unit>minute|minutes|hour|hours|day|days)/i
  );
  if (delayMatch && delayMatch.groups) {
    const rawVal = delayMatch.groups.value;
    const unitText = delayMatch.groups.unit;
    const wordToNum = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    if (rawVal && /^[0-9]+$/.test(rawVal)) {
      delayValue = parseInt(rawVal, 10);
    } else if (rawVal && wordToNum[rawVal]) {
      delayValue = wordToNum[rawVal];
    }
    if (unitText.startsWith('minute')) delayUnit = 'minutes';
    else if (unitText.startsWith('hour')) delayUnit = 'hours';
    else if (unitText.startsWith('day')) delayUnit = 'days';
  }

  let messageText = '';
  const msgSayingMatch = description.match(/message\s+saying\s+["']?([^"']+)["']?/i);
  if (msgSayingMatch) {
    messageText = msgSayingMatch[1].trim();
  } else {
    const msgTailMatch = description.match(/send\s+a?\s*message\s+(.+)$/i);
    if (msgTailMatch) {
      messageText = msgTailMatch[1].trim();
    }
  }

  const nodes = [];
  const edges = [];

  const triggerId = `node_trigger_${Date.now()}`;
  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: 0, y: 0 },
    data: { label: 'Start Workflow' },
  });

  let prevId = triggerId;
  let y = 140;
  let index = 0;

  if (templateName) {
    index += 1;
    const id = `node_${Date.now()}_${index}`;
    nodes.push({
      id,
      type: 'send_template',
      position: { x: 0, y },
      data: {
        label: templateName,
        template: templateName,
        languageCode: 'en_US',
        scheduleType: 'immediate',
        delayValue: null,
        delayUnit: null,
      },
    });
    edges.push({
      id: `e_${prevId}_${id}`,
      source: prevId,
      target: id,
    });
    prevId = id;
    y += 140;
  }

  if (messageText) {
    index += 1;
    const id = `node_${Date.now()}_${index}`;
    const scheduleType = delayValue > 0 && delayUnit ? 'delay' : 'immediate';
    nodes.push({
      id,
      type: 'send_message',
      position: { x: 0, y },
      data: {
        label: messageText,
        message: messageText,
        scheduleType,
        delayValue: scheduleType === 'delay' ? delayValue : null,
        delayUnit: scheduleType === 'delay' ? delayUnit : null,
      },
    });
    edges.push({
      id: `e_${prevId}_${id}`,
      source: prevId,
      target: id,
    });
    prevId = id;
    y += 140;
  }

  if (nodes.length === 1) {
    const e = new Error('Could not interpret description into workflow steps');
    e.status = 502;
    e.expose = true;
    throw e;
  }

  return { nodes, edges };
}

module.exports = {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow,
  triggerWorkflowsForEvent,
  triggerContactCreatedWorkflows,
  triggerWebhookWorkflows,
  generateWorkflowFromDescription,
  runStageWorkflows,
};
