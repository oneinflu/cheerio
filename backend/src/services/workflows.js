'use strict';
const db = require('../../db');
const whatsappClient = require('../integrations/meta/whatsappClient');
const outboundWhatsApp = require('./outboundWhatsApp');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

async function checkUserReply(phoneNumber, sinceTime) {
  if (!sinceTime) {
    console.log('[WorkflowRunner] checkUserReply: No sinceTime provided');
    return false;
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
      return false;
    }
    const contactId = contactRes.rows[0].id;
    console.log(`[WorkflowRunner] checkUserReply: Found contactId ${contactId}`);

    // Find conversation
    const convRes = await db.query('SELECT id FROM conversations WHERE contact_id = $1', [contactId]);
    if (convRes.rows.length === 0) {
       console.log(`[WorkflowRunner] checkUserReply: Conversation not found for contactId ${contactId}`);
       return false;
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
        const templateName = currentNode.data.template;
        if (templateName) {
           console.log(`[WorkflowRunner] Sending template ${templateName} to ${phoneNumber}`);
           // Resolve conversation and send via outbound service (persists to DB)
           try {
             const conversationId = await ensureConversation(phoneNumber);
             await outboundWhatsApp.sendTemplate(conversationId, templateName, 'en_US', []);
             lastTemplateSentAt = new Date();
           } catch (err) {
             console.error(`[WorkflowRunner] Failed to send template via service: ${err.message}`);
             // Fallback to direct client if DB fails (unlikely but safe)
             await whatsappClient.sendTemplateMessage(phoneNumber, templateName);
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
        console.log(`[WorkflowRunner] Executing action: ${currentNode.data.action}`);
        // TODO: Implement actual actions (e.g., update tag, add to list)
      }

      // 2. Move to Next Node
      if (currentNode.type === 'condition') {
         const conditionStr = currentNode.data.condition || '';
         console.log(`[WorkflowRunner] Evaluating condition: ${conditionStr}`);
         
         // Default to checking if user replied
         // Use lastTemplateSentAt if available, else workflowStartTime
         const since = lastTemplateSentAt || workflowStartTime;
         const replies = await checkUserReply(phoneNumber, since);
         const result = replies.length > 0;
         
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

module.exports = {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow
};
