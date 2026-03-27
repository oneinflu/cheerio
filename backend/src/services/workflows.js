'use strict';
const db = require('../../db');
const whatsappClient = require('../integrations/meta/whatsappClient');
const outboundWhatsApp = require('./outboundWhatsApp');
const fast2sms = require('./fast2sms');
const zeptoMail = require('./zeptoMail');
const razorpay = require('./razorpay');
const { findAgentForAssignment } = require('./agentAssignment');
const axios = require('axios');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

/**
 * Persists a scheduled task to DB
 */
async function scheduleWorkflowTask(wfId, phone, stageId, delayMins, targetTime, sequenceOrder, payload = {}) {
  const now = new Date();
  let scheduledTime = new Date(now.getTime() + (parseInt(delayMins, 10) || 0) * 60 * 1000);
  
  if (targetTime) {
      const [h, m] = targetTime.split(':').map(v => parseInt(v, 10) || 0);
      let targetDate = new Date(now);
      targetDate.setHours(h, m, 0, 0);
      if (targetDate < now) targetDate.setDate(targetDate.getDate() + 1);
      
      if (targetDate > scheduledTime) {
          scheduledTime = targetDate;
      }
  }

  console.log(`[WorkflowQueue] Scheduling WF=${wfId} for ${phone} at ${scheduledTime.toISOString()} (Stage=${stageId}, Position=${sequenceOrder})`);
  
  await db.query(`
    INSERT INTO workflow_scheduled_tasks (
      workflow_id, contact_phone, stage_id, scheduled_time, sequence_order, payload
    ) 
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (workflow_id, contact_phone, stage_id, sequence_order) WHERE status = 'pending' 
    DO UPDATE SET scheduled_time = EXCLUDED.scheduled_time, payload = EXCLUDED.payload
  `, [wfId, phone, stageId, scheduledTime, sequenceOrder, JSON.stringify(payload)]);
}

/**
 * Background Worker to process pending tasks
 */
async function processScheduledTasks() {
    try {
        const res = await db.query(`
            UPDATE workflow_scheduled_tasks 
            SET status = 'executing', updated_at = NOW()
            WHERE id IN (
                SELECT id 
                FROM workflow_scheduled_tasks 
                WHERE status = 'pending' AND scheduled_time <= NOW()
                FOR UPDATE SKIP LOCKED
                LIMIT 5
            ) 
            RETURNING *
        `);

        for (const task of res.rows) {
            console.log(`[WorkflowQueue] Executing task ${task.id} for phone ${task.contact_phone} (WF=${task.workflow_id})`);
            
            try {
                const result = await runWorkflow(task.workflow_id, task.contact_phone, task.payload || {});
                
                await db.query('UPDATE workflow_scheduled_tasks SET status = $1, updated_at = NOW() WHERE id = $2', [result.success ? 'completed' : 'failed', task.id]);
                
                // If it was part of a stage sequence, check for NEXT
                if (task.stage_id && task.sequence_order !== -1) {
                    await scheduleNextStageWorkflow(task.stage_id, task.contact_phone, task.sequence_order);
                }
            } catch (err) {
                console.error(`[WorkflowQueue] Task ${task.id} exception:`, err.message);
                await db.query('UPDATE workflow_scheduled_tasks SET status = \'failed\', error_message = $1, updated_at = NOW() WHERE id = $2', [err.message, task.id]);
            }
        }
    } catch (err) {
        console.error('[WorkflowQueue] Worker loop error:', err.message);
    }
}

/**
 * Starts the interval-based queue processor
 */
function initQueueWorker(intervalMs = 30000) {
  console.log(`[WorkflowQueue] Initializing Worker (interval=${intervalMs}ms)`);
  processScheduledTasks(); // Run once immediately
  setInterval(processScheduledTasks, intervalMs);
}

/**
 * Finds the next workflow in a stage sequence and schedules it.
 */
async function scheduleNextStageWorkflow(stageId, phoneNumber, currentPosition) {
    const res = await db.query(`
        SELECT lsw.workflow_id, lsw.delay_minutes, lsw.target_time, lsw.position, w.name, w.steps
        FROM lead_stage_workflows lsw
        JOIN workflows w ON w.id = lsw.workflow_id
        WHERE lsw.stage_id = $1 AND lsw.position > $2 AND lsw.is_independent = FALSE AND w.status = 'active'
        ORDER BY lsw.position ASC
        LIMIT 1
    `, [stageId, currentPosition]);

    if (res.rowCount > 0) {
        const next = res.rows[0];
        console.log(`[WorkflowQueue] Chaining next workflow: ${next.name} (Position ${next.position}) after ${phoneNumber} finished previous`);
        
        // Wait! We should check if the contact still matches the NEW workflow's label/course triggers if any
        // But for Lead Stage sequences, it's usually unconditional since they are literally IN that stage.
        
        await scheduleWorkflowTask(
            next.workflow_id, 
            phoneNumber, 
            stageId, 
            next.delay_minutes, 
            next.target_time, 
            next.position
        );
    }
}

async function listWorkflows(teamId) {
  const res = await db.query('SELECT * FROM workflows WHERE team_id = $1 ORDER BY created_at DESC', [teamId]);
  return res.rows;
}

async function getWorkflow(id) {
  const res = await db.query('SELECT * FROM workflows WHERE id = $1', [id]);
  return res.rows[0];
}

async function createWorkflow(workflowData) {
  const { team_id, name, trigger, nodes, edges, status = 'active' } = workflowData;
  const res = await db.query(
    'INSERT INTO workflows (team_id, name, "trigger", nodes, edges, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [team_id, name, trigger, JSON.stringify(nodes), JSON.stringify(edges), status]
  );
  return res.rows[0];
}

async function updateWorkflow(id, workflowData) {
  const { name, trigger, nodes, edges, status } = workflowData;
  const res = await db.query(
    'UPDATE workflows SET name = $1, "trigger" = $2, nodes = $3, edges = $4, status = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
    [name, trigger, JSON.stringify(nodes), JSON.stringify(edges), status, id]
  );
  return res.rows[0];
}

async function deleteWorkflow(id) {
  await db.query('DELETE FROM workflows WHERE id = $1', [id]);
  return { success: true };
}

/**
 * Triggers workflows for a contact based on an event type.
 */
async function triggerWorkflowsForEvent(teamId, phoneNumber, eventType, payload = {}) {
  console.log(`[Workflows] Triggering event=${eventType} for phone=${phoneNumber}`);
  const res = await db.query(
    "SELECT * FROM workflows WHERE team_id = $1 AND trigger = $2 AND status = 'active'",
    [teamId, eventType]
  );

  const results = [];
  for (const wf of res.rows) {
    results.push(runWorkflow(wf.id, phoneNumber, payload));
  }
  return Promise.all(results);
}

/**
 * Triggers workflows for a contact when a contact is created
 */
async function triggerContactCreatedWorkflows(teamId, phoneNumber, contactData = {}) {
    return triggerWorkflowsForEvent(teamId, phoneNumber, 'new_contact', contactData);
}

/**
 * Triggers workflows for a generic incoming webhook
 */
async function triggerWebhookWorkflows(teamId, workflowId, payload = {}) {
    // Only run the SPECIFIC workflow requested by the webhook ID
    const res = await db.query(
        "SELECT * FROM workflows WHERE id = $1 AND status = 'active' AND team_id = $2",
        [workflowId, teamId]
    );

    if (res.rowCount === 0) {
        console.warn(`[Workflows] Webhook received for non-existent or inactive workflow ID: ${workflowId}`);
        return [];
    }

    const wf = res.rows[0];
    const phone = payload.phone || payload.whatsapp || payload.contact || payload.mobile || '';
    
    if (!phone) {
        console.error(`[Workflows] Webhook payload missing phone number. Workflow ID: ${workflowId}`);
        return [];
    }

    return [runWorkflow(wf.id, phone, payload)];
}

/**
 * Utility: Polls for inbound messages after a certain date
 */
async function checkUserReply(phoneNumber, sinceDate) {
    const res = await db.query(`
        SELECT id, body, created_at 
        FROM messages 
        WHERE contact_phone = $1 
          AND direction = 'inbound' 
          AND created_at > $2
        ORDER BY created_at DESC 
        LIMIT 1
    `, [phoneNumber, sinceDate]);
    
    return res.rows[0];
}

/**
 * Main execution engine for a workflow instance.
 */
async function runWorkflow(id, phoneNumber, initialContext = {}) {
  const workflow = await getWorkflow(id);
  if (!workflow) throw new Error('Workflow not found');

  const nodesRaw = workflow.nodes || workflow.steps || [];
  const nodes = Array.isArray(nodesRaw) ? nodesRaw : (nodesRaw.nodes || []);
  const edgesRaw = workflow.edges || (workflow.steps && workflow.steps.edges) || [];
  const edges = Array.isArray(edgesRaw) ? edgesRaw : [];
  const executionLog = [];
  const io = require('../realtime/io').getIO();

  // Find start node
  let currentNode = nodes.find((n) =>
    n.type === 'trigger' || n.type === 'incoming_webhook' ||
    n.type === 'new_contact' || n.type === 'campaign_trigger'
  );

  let context = { ...initialContext, phone: phoneNumber };
  let hasError = false;
  const workflowStartTime = new Date();

  console.log(`[WorkflowRunner] Starting WF=${id} for phone=${phoneNumber}`);

  while (currentNode) {
    executionLog.push({ nodeId: currentNode.id, type: currentNode.type, timestamp: new Date() });

    try {
      if (currentNode.type === 'trigger' || currentNode.type === 'incoming_webhook' || currentNode.type === 'new_contact') {
        // Triggers have no logic other than passing through
        currentNode = nodes.find((n) => n.id === currentNode.next);
      } else if (currentNode.type === 'action') {
        const { actionType, actionValue } = currentNode.data;

        if (actionType === 'update_chat_status') {
          // Change chat status in DB
          await db.query('UPDATE conversations SET status = $1 WHERE phone_number = $2', [actionValue, phoneNumber]);
        } else if (actionType === 'add_to_label') {
          // Label logic
          await db.query('INSERT INTO contact_labels (contact_phone, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [phoneNumber, actionValue]);
        } else if (actionType === 'update_lead_stage') {
          // Lead stage update
          await db.query('UPDATE conversations SET lead_stage_id = $1 WHERE phone_number = $2', [actionValue, phoneNumber]);
        } else if (actionType === 'send_email') {
          const { emailTemplateId, toVarKey, variableMapping } = currentNode.data;
          const toEmail = context[toVarKey] || context['email'];
          if (toEmail) {
            const mappedVars = {};
            if (variableMapping) {
              Object.entries(variableMapping).forEach(([tplVar, ctxVar]) => {
                mappedVars[tplVar] = context[ctxVar] || '';
              });
            }
            await zeptoMail.sendTemplate(toEmail, emailTemplateId, mappedVars);
          }
        } else if (actionType === 'send_sms_otp') {
          const { otpDigits, saveVariable } = currentNode.data;
          const otp = Math.floor(Math.random() * Math.pow(10, otpDigits)).toString().padStart(otpDigits, '0');
          await fast2sms.sendOTP(phoneNumber, otp);
          context[saveVariable || 'otp'] = otp;
        } else if (actionType === 'assign_agent') {
            const { assignMode, actionValue: agentId } = currentNode.data;
            let finalAgentId = agentId;
            if (assignMode === 'round_robin') {
                finalAgentId = await findAgentForAssignment(workflow.team_id);
            }
            if (finalAgentId) {
                await db.query('UPDATE conversations SET assigned_agent_id = $1 WHERE phone_number = $2', [finalAgentId, phoneNumber]);
            }
        } else if (actionType === 'start_workflow') {
            const targetWfId = currentNode.data.actionValue;
            if (targetWfId) {
                // Kick off another workflow asynchronously
                runWorkflow(targetWfId, phoneNumber, context);
            }
        }

        currentNode = nodes.find((n) => n.id === currentNode.next);
      } else if (currentNode.type === 'send_template') {
        const { template, languageCode, components, variables } = currentNode.data;

        // Replace placeholders in components if needed
        const processedComponents = (components || []).map((comp) => {
          if (!comp || !comp.parameters) return comp;
          const nextParameters = comp.parameters.map((param) => {
            if (param.type === 'text' && param.text && param.text.includes('{{')) {
              let replaced = param.text;
              Object.entries(context).forEach(([k, v]) => {
                replaced = replaced.replace(`{{${k}}}`, v);
              });
              return { ...param, text: replaced };
            }
            return param;
          });
          return { ...comp, parameters: nextParameters };
        });

        await outboundWhatsApp.sendTemplate(phoneNumber, template, languageCode, processedComponents);
        currentNode = nodes.find((n) => n.id === currentNode.next);
      } else if (currentNode.type === 'response_message') {
        const { message, buttons, headerType, headerUrl } = currentNode.data;
        let finalMessage = message;
        Object.entries(context).forEach(([k, v]) => {
          finalMessage = finalMessage.replace(`{{${k}}}`, v);
        });

        const buttonsConfig = (buttons || []).map((b) => ({ type: 'reply', reply: { id: b, title: b } }));
        await outboundWhatsApp.sendMessage(phoneNumber, finalMessage, buttonsConfig, headerType, headerUrl);
        currentNode = nodes.find((n) => n.id === currentNode.next);
      } else if (currentNode.type === 'delay') {
        // Since we are now using a persistent queue for the MAIN orchestration loops, 
        // internal node-level delays should also ideally be rescheduled.
        // But for simplicity during one workflow run, we sleep if short, or exit if long.
        const { days = 0, hours = 0, minutes = 0 } = currentNode.data;
        const totalMinutes = (days * 1440) + (hours * 60) + parseInt(minutes, 10);
        
        if (totalMinutes > 5) {
            // Schedule it via the task table and EXIT this execution
            console.log(`[WorkflowRunner] Long delay (${totalMinutes}m) detected. Rescheduling via DB queue.`);
            await scheduleWorkflowTask(id, phoneNumber, -1, totalMinutes, null, -1, context);
            currentNode = null;
        } else {
            console.log(`[WorkflowRunner] Short delay (${totalMinutes}m) - sleeping in-process.`);
            await sleep(totalMinutes * 60 * 1000);
            currentNode = nodes.find((n) => n.id === currentNode.next);
        }
      } else if (currentNode.type === 'condition') {
        const { variable, operator, value } = currentNode.data;
        const ctxValue = context[variable];
        let match = false;
        if (operator === 'eq') match = String(ctxValue) === String(value);
        if (operator === 'neq') match = String(ctxValue) !== String(value);

        const nextId = match ? currentNode.yes : currentNode.no;
        currentNode = nodes.find((n) => n.id === nextId);
      } else if (currentNode.type === 'user_replied' || currentNode.type === 'wait_for_reply') {
          const timeoutMins = parseInt(currentNode.data.timeoutMins || currentNode.data.timeout, 10) || 60;
          const startTime = new Date();
          const targetNodeId = currentNode.id;
          
          let hasReplied = false;
          let replyMessage = null;
          
          console.log(`[WorkflowRunner] Waiting for reply from ${phoneNumber} (timeout ${timeoutMins}m)`);
          
          // Poll every 5 seconds for the timeout duration
          const iterations = (timeoutMins * 60) / 5;
          for (let i = 0; i < iterations; i++) {
              replyMessage = await checkUserReply(phoneNumber, startTime);
              if (replyMessage) {
                  hasReplied = true;
                  break;
              }
              await sleep(5000); // 5 sec poll
          }
          
          const handle = hasReplied ? 'true' : 'false';
          const nextNodeId = currentNode.routes && currentNode.routes[handle];
          
          if (hasReplied) {
              context.last_reply = replyMessage.body;
              context.replied_at = replyMessage.created_at;
          }
          
          currentNode = nodes.find(n => n.id === nextNodeId);
      } else if (currentNode.type === 'feedback') {
          const { question } = currentNode.data;
          await outboundWhatsApp.sendMessage(phoneNumber, question);
          currentNode = nodes.find((n) => n.id === currentNode.next);
      } else if (currentNode.type === 'xolox_event') {
          const { webhookUrl, method, payloadFields, eventName } = currentNode.data;
          const payload = { event: eventName, phone: phoneNumber };
          
          if (payloadFields && Array.isArray(payloadFields)) {
              payloadFields.forEach(f => {
                  let val = f.variable;
                  if (val.startsWith('{{') && val.endsWith('}}')) {
                      const key = val.substring(2, val.length - 2);
                      payload[f.field] = context[key] || '';
                  } else {
                      payload[f.field] = val;
                  }
              });
          }

          let success = false;
          try {
              const xr = await axios({
                  method: method || 'POST',
                  url: webhookUrl,
                  data: payload,
                  timeout: 10000
              });
              success = xr.status >= 200 && xr.status < 300;
              context.xolox_response = xr.data;
          } catch (err) {
              console.error('[WorkflowRunner] XOLOX Event Failed:', err.message);
          }

          const nextId = success ? currentNode.onSuccess : currentNode.onFail;
          currentNode = nodes.find(n => n.id === nextId);
      } else {
        // Unknown or terminal node
        currentNode = null;
      }
    } catch (err) {
      console.error(`[WorkflowRunner] Error in node ${currentNode.id} (${currentNode.type}):`, err.message);
      hasError = true;
      currentNode = null;
    }
  }

  // Finalize
  const endedAt = new Date();
  const durationMs = endedAt.getTime() - workflowStartTime.getTime();
  
  if (db) {
    try {
      await db.query(`
        INSERT INTO workflow_runs (workflow_id, phone_number, status, execution_log, started_at, ended_at, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        id, phoneNumber, hasError ? 'failed' : 'completed', JSON.stringify(executionLog),
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

async function runStageWorkflows(phoneNumber, stageId, teamId) {
    const res = await db.query(`
        SELECT lsw.workflow_id, lsw.delay_minutes, lsw.target_time, lsw.position, w.name, w.steps
        FROM lead_stage_workflows lsw
        JOIN workflows w ON w.id = lsw.workflow_id
        WHERE lsw.stage_id = $1 AND lsw.is_independent = FALSE AND w.status = 'active'
        ORDER BY lsw.position ASC
        LIMIT 1
    `, [stageId]);

    if (res.rowCount > 0) {
        const first = res.rows[0];
        console.log(`[Workflows] Scheduling first workflow for stage=${stageId}: ${first.name} (Position ${first.position})`);
        
        await scheduleWorkflowTask(
            first.workflow_id, 
            phoneNumber, 
            stageId, 
            first.delay_minutes, 
            first.target_time, 
            first.position
        );
    }
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
  initQueueWorker,
  processScheduledTasks,
  scheduleWorkflowTask,
};
