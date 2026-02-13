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
                    // Append tag to profile.tags array if not exists
                    await db.query(`
                        UPDATE contacts 
                        SET profile = jsonb_set(
                            COALESCE(profile, '{}'::jsonb), 
                            '{tags}', 
                            CASE 
                              WHEN (COALESCE(profile->'tags', '[]'::jsonb) @> to_jsonb($1::text)) THEN COALESCE(profile->'tags', '[]'::jsonb)
                              ELSE (COALESCE(profile->'tags', '[]'::jsonb) || to_jsonb($1::text))
                            END
                        )
                        WHERE id = $2
                    `, [actionValue, contactId]);
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

module.exports = {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow
};
