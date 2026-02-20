'use strict';
const db = require('../../db');
const whatsappClient = require('../integrations/meta/whatsappClient');
const outboundWhatsApp = require('./outboundWhatsApp');
const axios = require('axios');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

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
    const channelRes = await db.query("SELECT id FROM channels WHERE type = 'whatsapp' LIMIT 1");
    if (channelRes.rowCount === 0) throw new Error('No WhatsApp channel configured');
    const channelId = channelRes.rows[0].id;

    // Create contact
    const createContact = await db.query(
      `INSERT INTO contacts (id, channel_id, external_id, display_name, profile)
       VALUES (gen_random_uuid(), $1, $2, 'Unknown', '{}'::jsonb)
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

async function deleteWorkflow(id) {
  await db.query(`DELETE FROM workflows WHERE id = $1`, [id]);
  return { success: true };
}

async function triggerWorkflowsForEvent(triggerType, phoneNumber, context = {}, excludeWorkflowId = null) {
  if (!triggerType || !phoneNumber) {
    return;
  }
  try {
    const res = await db.query(
      `
      SELECT id, steps
      FROM workflows
      WHERE status = 'active'
      `
    );
    const rows = res.rows || [];
    for (const row of rows) {
      const id = row.id;
      if (excludeWorkflowId && String(id) === String(excludeWorkflowId)) continue;
      const steps = row.steps || {};
      const wfTrigger = steps.trigger || steps.event || null;
      if (wfTrigger === triggerType) {
        console.log(
          `[WorkflowEvents] Triggering workflow ${id} for event ${triggerType} and phone ${phoneNumber}`
        );
        runWorkflow(id, phoneNumber).catch((err) => {
          console.error(
            `[WorkflowEvents] Workflow ${id} failed for event ${triggerType}: ${err.message}`
          );
        });
      }
    }
  } catch (err) {
    console.error(
      `[WorkflowEvents] Failed to trigger workflows for event ${triggerType}:`,
      err
    );
  }
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

async function runWorkflow(id, phoneNumber) {
  const workflow = await getWorkflow(id);
  if (!workflow) throw new Error('Workflow not found');

  const { steps } = workflow;
  if (!steps || !steps.nodes) throw new Error('Invalid workflow definition: no steps found');

  const { nodes } = steps;
  
  // Find trigger node
  let currentNode = nodes.find(n => n.type === 'trigger');
  if (!currentNode) throw new Error('No trigger node found');

  const executionLog = [];
  const MAX_STEPS = 50;
  let stepCount = 0;
  
  // Context state
  let lastTemplateSentAt = null;
  const workflowStartTime = new Date();

  console.log(`[WorkflowRunner] Starting workflow ${id} for ${phoneNumber}`);

  while (currentNode && stepCount < MAX_STEPS) {
    stepCount++;
    executionLog.push({ 
      step: stepCount, 
      nodeId: currentNode.id, 
      type: currentNode.type,
      status: 'started' 
    });

    try {
      // 1. Execute Node Logic
      if (currentNode.type === 'send_template') {
        const nodeData = currentNode.data || {};
        const templateName = nodeData.template;
        if (templateName) {
           const components = Array.isArray(nodeData.components) ? nodeData.components : [];
           const languageCode = nodeData.languageCode || 'en_US';
           console.log(`[WorkflowRunner] Sending template ${templateName} to ${phoneNumber}`);
           // Resolve conversation and send via outbound service (persists to DB)
           try {
             const conversationId = await ensureConversation(phoneNumber);
             await outboundWhatsApp.sendTemplate(conversationId, templateName, languageCode, components);
             lastTemplateSentAt = new Date();
           } catch (err) {
             console.error(`[WorkflowRunner] Failed to send template via service: ${err.message}`);
             // Fallback to direct client if DB fails (unlikely but safe)
             await whatsappClient.sendTemplateMessage(phoneNumber, templateName, languageCode, components);
             lastTemplateSentAt = new Date();
           }

           // Handle Quick Reply Buttons (Branching)
           if (currentNode.routes && Object.keys(currentNode.routes).length > 0) {
              console.log(`[WorkflowRunner] Waiting for user reply to match buttons: ${Object.keys(currentNode.routes).join(', ')}`);
              const pollingStart = Date.now();
              const TIMEOUT = 5 * 60 * 1000; // 5 mins wait max
              let matchedRoute = null;
              
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
      } else if (currentNode.type === 'custom_code') {
        console.log(`[WorkflowRunner] Executing custom code (mock): ${currentNode.data.code}`);
        // In a real system, use vm2 or isolated sandbox
      } else if (currentNode.type === 'delay') {
        const duration = parseInt(currentNode.data.duration || 0, 10);
        const unit = currentNode.data.unit || 'minutes';
        let ms = 0;
        
        if (unit === 'seconds') ms = duration * 1000;
        else if (unit === 'minutes') ms = duration * 60 * 1000;
        else if (unit === 'hours') ms = duration * 60 * 60 * 1000;
        else if (unit === 'days') ms = duration * 24 * 60 * 60 * 1000;
        
        console.log(`[WorkflowRunner] Waiting for ${duration} ${unit} (${ms}ms)`);
        if (ms > 0) await sleep(ms);
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
            } else if (actionType === 'assign_agent') {
                // Find user by email (assuming actionValue is email)
                const userRes = await db.query('SELECT id FROM users WHERE email = $1', [actionValue]);
                if (userRes.rowCount > 0) {
                    const userId = userRes.rows[0].id;
                    // Find a team for this user
                    const teamRes = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [userId]);
                    if (teamRes.rowCount > 0) {
                        const teamId = teamRes.rows[0].team_id;
                        // Upsert assignment (close old one implicitly by constraint? No, constraint is partial unique index)
                        // We need to release old assignment first if exists, or update it?
                        // The index is: UNIQUE (conversation_id) WHERE released_at IS NULL
                        // So we can update the existing active assignment or insert new one.
                        
                        // Check for existing active assignment
                        const existing = await db.query(
                            'SELECT id FROM conversation_assignments WHERE conversation_id = $1 AND released_at IS NULL',
                            [conversationId]
                        );
                        
                        if (existing.rowCount > 0) {
                            // Release it or Update it? Update is cleaner for transfer.
                             await db.query(`
                                UPDATE conversation_assignments
                                SET assignee_user_id = $1, team_id = $2, claimed_at = NOW()
                                WHERE id = $3
                            `, [userId, teamId, existing.rows[0].id]);
                        } else {
                            // Insert new
                            await db.query(`
                                INSERT INTO conversation_assignments (conversation_id, team_id, assignee_user_id)
                                VALUES ($1, $2, $3)
                            `, [conversationId, teamId, userId]);
                        }
                        console.log(`[WorkflowRunner] Assigned conversation to ${actionValue}`);
                    } else {
                        console.log(`[WorkflowRunner] User ${actionValue} is not in any team`);
                    }
                } else {
                    console.log(`[WorkflowRunner] User ${actionValue} not found`);
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
        }
      }

      // 2. Move to Next Node
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
         
         const nextId = result ? currentNode.yes : currentNode.no;
         currentNode = nextId ? nodes.find(n => n.id === nextId) : null;
      } else if (currentNode.type === 'end') {
         currentNode = null;
      } else {
         const nextId = currentNode.next;
         currentNode = nextId ? nodes.find(n => n.id === nextId) : null;
      }

    } catch (err) {
      console.error(`[WorkflowRunner] Error at node ${currentNode.id}:`, err);
      executionLog.push({ error: err.message });
      // Stop execution on error
      break;
    }
  }

  return { success: true, log: executionLog };
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
    const scheduleType = schedule.type === 'delay' ? 'delay' : 'immediate';
    const delayValue =
      scheduleType === 'delay' && typeof schedule.value === 'number'
        ? schedule.value
        : null;
    const delayUnit =
      scheduleType === 'delay' && typeof schedule.unit === 'string'
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
  generateWorkflowFromDescription,
};
