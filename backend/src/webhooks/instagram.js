'use strict';
/**
 * src/webhooks/instagram.js
 *
 * Purpose:
 * - Implements Instagram Messaging API webhook verification (GET) and ingestion (POST).
 * - Handles verification challenge from Meta.
 * - Receives and processes incoming Instagram messages/events.
 * - Supports auto-reply, comment-to-DM, and auto-DM automations.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Verify token for GET challenge.
const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || '';
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || '';

/**
 * GET /webhooks/instagram
 * Webhook verification endpoint required by Meta.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[Instagram Webhook] Verification request received.');
  console.log(`[Instagram Webhook] Mode: ${mode}`);
  console.log(`[Instagram Webhook] Token received: ${token}`);
  console.log(`[Instagram Webhook] Token expected: ${VERIFY_TOKEN}`);
  
  if (!VERIFY_TOKEN) {
    console.error('[Instagram Webhook] Error: VERIFY_TOKEN is not set in environment variables.');
  }

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Instagram Webhook] Verification successful. Returning challenge.');
    return res.status(200).send(challenge);
  }
  
  if (mode === 'subscribe' && token !== VERIFY_TOKEN) {
     console.warn('[Instagram Webhook] Verification failed: Token mismatch.');
     console.warn(`[Instagram Webhook] Expected: "${VERIFY_TOKEN}", Received: "${token}"`);
  }

  return res.status(403).json({ error: 'Forbidden', detail: 'Verify token mismatch' });
});

/**
 * POST /webhooks/instagram
 * Ingest inbound messages/events.
 */
router.post('/', (req, res) => {
  const body = req.body || {};

  console.log('[Instagram Webhook] Received event:', JSON.stringify(body, null, 2));

  // Webhook signature verification
  if (APP_SECRET) {
    try {
      const header = req.headers['x-hub-signature-256'] || '';
      const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody || '').digest('hex');
      
      if (header !== expected) {
        console.warn('[Instagram Webhook] Signature mismatch.', { received: header, expected });
      }
    } catch (err) {
      console.error('[Instagram Webhook] Signature verification error:', err);
    }
  }

  if (body.object === 'instagram' || body.object === 'page') {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    
    entries.forEach(entry => {
      const messagingEvents = entry.messaging || [];
      const changes = entry.changes || [];
      
      console.log(`[Instagram Webhook] Entry ID: ${entry.id}`);

      // Process Messaging Events (Direct Messages)
      messagingEvents.forEach(event => {
        console.log('[Instagram Webhook] Messaging Event:', JSON.stringify(event, null, 2));
        
        if (event.message) {
           if (event.message.is_echo) {
               console.log('[Instagram Webhook] Handling echo message (outbound from Instagram App)');
               handleEchoMessage(event, entry.id);
           } else {
               handleIncomingMessage(event, entry.id);
           }
        }
        
        // Handle message reactions
        if (event.reaction) {
          console.log('[Instagram Webhook] Reaction event:', event.reaction);
        }
        
        // Handle postbacks (button taps in quick replies, ice breakers, etc.)
        if (event.postback) {
          console.log('[Instagram Webhook] Postback event:', event.postback);
          handleIncomingMessage({
            ...event,
            message: {
              mid: `postback_${Date.now()}`,
              text: event.postback.title || event.postback.payload || 'Button tap'
            }
          }, entry.id);
        }
      });

      // Process Changes (Comments, Mentions, etc.)
      changes.forEach(change => {
        console.log('[Instagram Webhook] Change Event:', JSON.stringify(change, null, 2));
        
        if (change.field === 'comments') {
          handleComment(change.value, entry.id);
        }
        
        if (change.field === 'mentions') {
          console.log('[Instagram Webhook] Story mention from:', change.value);
        }
      });
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    console.warn(`[Instagram Webhook] Unknown object type: ${body.object}`);
    res.sendStatus(404);
  }
});

/**
 * Handle incoming Instagram message
 */
async function handleIncomingMessage(event, entryId) {
    const db = require('../../db');
    const { getIO } = require('../realtime/io');

    const senderId = event.sender.id;
    const recipientId = event.recipient.id;
    const messageId = event.message.mid;
    const textBody = event.message.text || '';
    const attachments = event.message.attachments || [];
    const timestamp = event.timestamp;

    console.log(`[Instagram Webhook] Processing message from ${senderId} to ${recipientId} (Entry ID: ${entryId})`);

    try {
        // 1. Ensure Channel Exists
        let channelRes = await db.query('SELECT id, config FROM channels WHERE type = $1 AND external_id = $2', ['instagram', recipientId]);
        
        if (channelRes.rows.length === 0) {
             console.log(`[Instagram Webhook] Channel not found for recipient ${recipientId}. Checking entry ID ${entryId}...`);
             channelRes = await db.query('SELECT id, config FROM channels WHERE type = $1 AND external_id = $2', ['instagram', entryId]);
        }

        if (channelRes.rows.length === 0) {
            console.warn(`[Instagram Webhook] Channel for recipient ${recipientId} OR entry ${entryId} not found. Message ignored.`);
            const allCh = await db.query('SELECT external_id, name FROM channels WHERE type = $1', ['instagram']);
            console.log('[Instagram Webhook] Available Instagram Channels:', allCh.rows);
            return;
        }
        const channelId = channelRes.rows[0].id;
        const channelConfig = channelRes.rows[0].config || {};
        
        // 2. Upsert Contact (The sender)
        let displayName = `Instagram User ${senderId}`;
        
        // Try to fetch username from Instagram Graph API
        try {
          const accessToken = channelConfig.accessToken || channelConfig.page_token || process.env.WHATSAPP_TOKEN;
          if (accessToken) {
            const axios = require('axios');
            const profileRes = await axios.get(`https://graph.facebook.com/v21.0/${senderId}`, {
              params: { fields: 'name,username', access_token: accessToken }
            });
            if (profileRes.data?.name) {
              displayName = profileRes.data.name;
            } else if (profileRes.data?.username) {
              displayName = `@${profileRes.data.username}`;
            }
          }
        } catch (profileErr) {
          console.log('[Instagram Webhook] Could not fetch profile for sender:', profileErr.message);
        }
        
        const contactRes = await db.query(`
            INSERT INTO contacts (channel_id, external_id, display_name, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (channel_id, external_id) DO UPDATE SET
              display_name = CASE WHEN contacts.display_name LIKE 'Instagram User%' THEN $3 ELSE contacts.display_name END,
              updated_at = NOW()
            RETURNING id
        `, [channelId, senderId, displayName]);
        
        const contactId = contactRes.rows[0].id;

        // 3. Find or Create Conversation
        let convRes = await db.query(`
            SELECT id FROM conversations 
            WHERE channel_id = $1 AND contact_id = $2 AND status != 'closed'
            ORDER BY created_at DESC LIMIT 1
        `, [channelId, contactId]);

        let conversationId;
        if (convRes.rows.length > 0) {
            conversationId = convRes.rows[0].id;
            await db.query('UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1', [conversationId]);
        } else {
            const newConv = await db.query(`
                INSERT INTO conversations (channel_id, contact_id, status, last_message_at)
                VALUES ($1, $2, 'open', NOW())
                RETURNING id
            `, [channelId, contactId]);
            conversationId = newConv.rows[0].id;
        }

        // 4. Determine content type
        let contentType = 'text';
        let processedAttachments = [];
        
        if (attachments.length > 0) {
          const att = attachments[0];
          if (att.type === 'image') contentType = 'image';
          else if (att.type === 'video') contentType = 'video';
          else if (att.type === 'audio') contentType = 'audio';
          else if (att.type === 'share' || att.type === 'story_mention') contentType = 'text';
          else contentType = att.type || 'text';
        }

        // 5. Insert Message
        let tsSeconds = timestamp;
        if (timestamp > 9999999999) {
            tsSeconds = timestamp / 1000;
        }

        const msgRes = await db.query(`
            INSERT INTO messages (
                conversation_id, channel_id, direction, content_type, 
                external_message_id, text_body, delivery_status, raw_payload, created_at
            )
            VALUES ($1, $2, 'inbound', $3, $4, $5, 'delivered', $6, to_timestamp($7))
            ON CONFLICT (channel_id, external_message_id) DO NOTHING
            RETURNING id
        `, [conversationId, channelId, contentType, messageId, textBody, event, tsSeconds]);

        if (msgRes.rowCount > 0) {
            const dbMessageId = msgRes.rows[0].id;
            console.log(`[Instagram Webhook] Message ${messageId} stored. Conversation: ${conversationId}`);
            
            // Insert attachments if any
            for (const att of attachments) {
              if (att.payload?.url) {
                try {
                  await db.query(`
                    INSERT INTO attachments (id, message_id, kind, url, mime_type, created_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, NULL, NOW())
                  `, [dbMessageId, att.type || 'image', att.payload.url]);
                  processedAttachments.push({ kind: att.type, url: att.payload.url });
                } catch (attErr) {
                  console.warn('[Instagram Webhook] Failed to store attachment:', attErr.message);
                }
              }
            }
            
            // Emit Realtime Event
            const io = getIO();
            if (io) {
                const payload = {
                    conversationId,
                    messageId: dbMessageId,
                    contentType,
                    textBody,
                    direction: 'inbound',
                    attachments: processedAttachments,
                    rawPayload: event
                };
                io.to(`conversation:${conversationId}`).emit('message:new', payload);
                io.emit('message:new', payload);
            }
            
            // 6. Check Auto-Reply automations
            await checkAutoReplyRules(channelId, senderId, textBody, conversationId, channelConfig);
        } else {
            console.log(`[Instagram Webhook] Duplicate message ${messageId} ignored.`);
        }

    } catch (err) {
        console.error('[Instagram Webhook] Error processing message:', err);
    }
}

/**
 * Handle Echo Message (Outbound sent from Instagram App/Business Suite)
 */
async function handleEchoMessage(event, entryId) {
    const db = require('../../db');
    const { getIO } = require('../realtime/io');

    const senderId = event.sender.id; 
    const recipientId = event.recipient.id;
    const messageId = event.message.mid;
    const textBody = event.message.text || '';
    const timestamp = event.timestamp;

    console.log(`[Instagram Webhook] Processing ECHO from ${senderId} to ${recipientId} (Entry: ${entryId})`);

    try {
        let channelRes = await db.query('SELECT id, config FROM channels WHERE type = $1 AND external_id = $2', ['instagram', senderId]);
        
        if (channelRes.rows.length === 0) {
             console.log(`[Instagram Webhook] Channel not found for sender ${senderId}. Checking entry ID ${entryId}...`);
             channelRes = await db.query('SELECT id, config FROM channels WHERE type = $1 AND external_id = $2', ['instagram', entryId]);
        }

        if (channelRes.rows.length === 0) {
            console.warn(`[Instagram Webhook] Channel not found for sender ${senderId} OR entry ${entryId} (Echo). Message ignored.`);
            return;
        }
        const channelId = channelRes.rows[0].id;

        let displayName = `Instagram User ${recipientId}`;
        const contactRes = await db.query(`
            INSERT INTO contacts (channel_id, external_id, display_name, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (channel_id, external_id) DO UPDATE SET updated_at = NOW()
            RETURNING id
        `, [channelId, recipientId, displayName]);
        const contactId = contactRes.rows[0].id;

        let convRes = await db.query(`
            SELECT id FROM conversations 
            WHERE channel_id = $1 AND contact_id = $2 AND status != 'closed'
            ORDER BY created_at DESC LIMIT 1
        `, [channelId, contactId]);

        let conversationId;
        if (convRes.rows.length > 0) {
            conversationId = convRes.rows[0].id;
            await db.query('UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1', [conversationId]);
        } else {
            const newConv = await db.query(`
                INSERT INTO conversations (channel_id, contact_id, status, last_message_at)
                VALUES ($1, $2, 'open', NOW())
                RETURNING id
            `, [channelId, contactId]);
            conversationId = newConv.rows[0].id;
        }

        let tsSeconds = timestamp;
        if (timestamp > 9999999999) tsSeconds = timestamp / 1000;

        const msgRes = await db.query(`
            INSERT INTO messages (
                conversation_id, channel_id, direction, content_type, 
                external_message_id, text_body, delivery_status, raw_payload, created_at
            )
            VALUES ($1, $2, 'outbound', 'text', $3, $4, 'sent', $5, to_timestamp($6))
            ON CONFLICT (channel_id, external_message_id) DO NOTHING
            RETURNING id
        `, [conversationId, channelId, messageId, textBody, event, tsSeconds]);

        if (msgRes.rowCount > 0) {
            console.log(`[Instagram Webhook] Echo message ${messageId} stored.`);
            const io = getIO();
            if (io) {
                const payload = {
                    conversationId,
                    messageId: msgRes.rows[0].id,
                    contentType: 'text',
                    textBody,
                    direction: 'outbound',
                    attachments: [],
                    rawPayload: event
                };
                io.to(`conversation:${conversationId}`).emit('message:new', payload);
                io.emit('message:new', payload);
            }
        }

    } catch (err) {
        console.error('[Instagram Webhook] Error processing echo message:', err);
    }
}

/**
 * Handle Instagram Comment events (for Comment-to-DM automation)
 */
async function handleComment(commentValue, entryId) {
    const db = require('../../db');
    
    if (!commentValue) return;
    
    const commentText = commentValue.text || '';
    const commenterId = commentValue.from?.id;
    const mediaId = commentValue.media?.id;
    
    console.log(`[Instagram Webhook] Comment from ${commenterId} on media ${mediaId}: "${commentText}"`);
    
    if (!commenterId) return;
    
    try {
      // Find the Instagram channel for this entry
      let channelRes = await db.query(
        'SELECT id, config FROM channels WHERE type = $1 AND external_id = $2 AND active = true',
        ['instagram', entryId]
      );
      
      if (channelRes.rows.length === 0) {
        // Try finding any active Instagram channel
        channelRes = await db.query(
          'SELECT id, config FROM channels WHERE type = $1 AND active = true LIMIT 1',
          ['instagram']
        );
      }
      
      if (channelRes.rows.length === 0) {
        console.log('[Instagram Webhook] No active Instagram channel found for comment handling.');
        return;
      }
      
      const channelId = channelRes.rows[0].id;
      const channelConfig = channelRes.rows[0].config || {};
      
      // Check comment-to-DM automation rules
      const automationRes = await db.query(
        `SELECT * FROM instagram_automations 
         WHERE channel_id = $1 AND type = 'comment_dm' AND is_active = true`,
        [channelId]
      );
      
      if (automationRes.rows.length === 0) {
        console.log('[Instagram Webhook] No active comment-to-DM automations found.');
        return;
      }
      
      for (const rule of automationRes.rows) {
        const trigger = rule.trigger_config || {};
        const action = rule.action_config || {};
        
        // Check if comment matches the trigger keyword
        let matches = false;
        
        if (trigger.comment_keyword) {
          const keywords = trigger.comment_keyword.split(',').map(k => k.trim().toLowerCase());
          matches = keywords.some(kw => commentText.toLowerCase().includes(kw));
        } else {
          // No keyword filter = match all comments
          matches = true;
        }
        
        // Check if targeting specific post
        if (trigger.post_id && mediaId && trigger.post_id !== mediaId) {
          matches = false;
        }
        
        if (matches && action.message) {
          console.log(`[Instagram Webhook] Comment-to-DM rule "${rule.name}" triggered!`);
          
          // Send auto DM
          const accessToken = channelConfig.accessToken || channelConfig.page_token || process.env.WHATSAPP_TOKEN;
          if (!accessToken) {
            console.warn('[Instagram Webhook] No access token for auto DM.');
            continue;
          }
          
          try {
            const { sendAutoDM } = require('../services/outboundInstagram');
            
            // Optionally delay
            const delayMs = (action.delay_seconds || 0) * 1000;
            if (delayMs > 0) {
              setTimeout(async () => {
                try {
                  await sendAutoDM(channelId, commenterId, action.message);
                  console.log(`[Instagram Webhook] Comment-to-DM sent to ${commenterId}`);
                } catch (err) {
                  console.error('[Instagram Webhook] Delayed Comment-to-DM failed:', err.message);
                }
              }, delayMs);
            } else {
              await sendAutoDM(channelId, commenterId, action.message);
              console.log(`[Instagram Webhook] Comment-to-DM sent to ${commenterId}`);
            }
          } catch (dmErr) {
            console.error('[Instagram Webhook] Comment-to-DM send failed:', dmErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[Instagram Webhook] Error handling comment:', err);
    }
}

/**
 * Check and execute auto-reply rules for incoming messages
 */
async function checkAutoReplyRules(channelId, senderId, textBody, conversationId, channelConfig) {
    const db_module = require('../../db');
    
    try {
      const automationRes = await db_module.query(
        `SELECT * FROM instagram_automations 
         WHERE channel_id = $1 AND type = 'auto_reply' AND is_active = true`,
        [channelId]
      );
      
      if (automationRes.rows.length === 0) return;
      
      for (const rule of automationRes.rows) {
        const trigger = rule.trigger_config || {};
        const action = rule.action_config || {};
        
        let matches = false;
        
        if (trigger.keyword) {
          const keywords = trigger.keyword.split(',').map(k => k.trim().toLowerCase());
          matches = keywords.some(kw => textBody.toLowerCase().includes(kw));
        } else {
          // No keyword = reply to all messages
          matches = true;
        }
        
        if (matches && action.message) {
          console.log(`[Instagram Webhook] Auto-reply rule "${rule.name}" triggered!`);
          
          try {
            const { sendAutoDM } = require('../services/outboundInstagram');
            
            const delayMs = (action.delay_seconds || 2) * 1000; // Default 2s delay for natural feel
            setTimeout(async () => {
              try {
                await sendAutoDM(channelId, senderId, action.message);
                console.log(`[Instagram Webhook] Auto-reply sent to ${senderId}`);
              } catch (err) {
                console.error('[Instagram Webhook] Auto-reply send failed:', err.message);
              }
            }, delayMs);
          } catch (err) {
            console.error('[Instagram Webhook] Auto-reply error:', err.message);
          }
          
          break; // Only trigger first matching rule
        }
      }
    } catch (err) {
      console.error('[Instagram Webhook] Error checking auto-reply rules:', err);
    }
}

module.exports = router;
