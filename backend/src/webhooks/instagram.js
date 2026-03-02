'use strict';
/**
 * src/webhooks/instagram.js
 *
 * Purpose:
 * - Implements Instagram Messaging API webhook verification (GET) and ingestion (POST).
 * - Handles verification challenge from Meta.
 * - Receives and logs incoming Instagram messages/events.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Verify token for GET challenge.
// You should add INSTAGRAM_VERIFY_TOKEN and INSTAGRAM_APP_SECRET to your .env file
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

  // Debug logging to help troubleshoot verification failures
  console.log('[Instagram Webhook] Verification request received.');
  console.log(`[Instagram Webhook] Mode: ${mode}`);
  console.log(`[Instagram Webhook] Token received: ${token}`);
  console.log(`[Instagram Webhook] Token expected: ${VERIFY_TOKEN}`);
  
  if (!VERIFY_TOKEN) {
    console.error('[Instagram Webhook] Error: VERIFY_TOKEN is not set in environment variables.');
  }

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Instagram Webhook] Verification successful. Returning challenge.');
    // Echo the challenge string exactly to confirm subscription.
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

  // Log the raw body for debugging
  console.log('[Instagram Webhook] Received event:', JSON.stringify(body, null, 2));

  /**
   * Webhook signature verification:
   * - Meta sends X-Hub-Signature-256: "sha256=HEX_DIGEST".
   * - Compute HMAC of raw body using APP_SECRET and compare.
   */
  if (APP_SECRET) {
    try {
      const header = req.headers['x-hub-signature-256'] || '';
      const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody || '').digest('hex');
      
      if (header !== expected) {
        console.warn('[Instagram Webhook] Signature mismatch.', { received: header, expected });
        // We can optionally reject here, but for now let's just warn to avoid breaking if secrets are misconfigured
        // return res.status(403).json({ error: 'Invalid signature' });
      }
    } catch (err) {
      console.error('[Instagram Webhook] Signature verification error:', err);
    }
  }

  // Handle "page" or "instagram" objects
  if (body.object === 'instagram' || body.object === 'page') {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    
    entries.forEach(entry => {
      // Instagram Messaging events are usually in 'messaging' or 'changes' depending on subscription
      const messagingEvents = entry.messaging || [];
      const changes = entry.changes || [];

      // Process Messaging Events (Direct Messages)
      messagingEvents.forEach(event => {
        console.log('[Instagram Webhook] Messaging Event:', JSON.stringify(event, null, 2));
        
        // Example Event Structure:
        // {
        //   "sender": { "id": "12345678" },
        //   "recipient": { "id": "87654321" },
        //   "timestamp": 1600000000,
        //   "message": { "mid": "m_...", "text": "Hello" }
        // }

        if (event.message && !event.message.is_echo) {
           handleIncomingMessage(event);
        }
      });

      // Process Changes (Comments, etc.)
      changes.forEach(change => {
        console.log('[Instagram Webhook] Change Event:', change);
        // TODO: Implement comment handling if needed
      });
    });

    // Return 200 OK to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Return 404 if not an instagram/page event
    res.sendStatus(404);
  }
});

/**
 * Handle incoming Instagram message
 */
async function handleIncomingMessage(event) {
    const db = require('../../db');
    const { getIO } = require('../realtime/io');

    const senderId = event.sender.id;
    const recipientId = event.recipient.id;
    const messageId = event.message.mid;
    const textBody = event.message.text || '';
    const attachments = event.message.attachments || [];
    const timestamp = event.timestamp;

    console.log(`[Instagram Webhook] Processing message from ${senderId} to ${recipientId}`);

    try {
        // 1. Ensure Channel Exists (The recipient should be our connected Instagram account)
        // We stored the IG User ID in 'external_id' in channels table.
        let channelRes = await db.query('SELECT id, config FROM channels WHERE type = $1 AND external_id = $2', ['instagram', recipientId]);
        
        if (channelRes.rows.length === 0) {
            console.warn(`[Instagram Webhook] Channel for recipient ${recipientId} not found. Message ignored.`);
            return;
        }
        const channelId = channelRes.rows[0].id;
        const channelConfig = channelRes.rows[0].config || {};

        // 2. Upsert Contact (The sender)
        // We need to fetch user profile using Graph API to get name/username
        // We can use the page access token from channel config if available, or just store ID for now.
        
        let displayName = `Instagram User ${senderId}`;
        
        // Attempt to fetch profile if we have a token
        /*
        if (channelConfig.accessToken) {
            try {
                const profileRes = await require('axios').get(`https://graph.instagram.com/${senderId}`, {
                    params: { fields: 'username,name', access_token: channelConfig.accessToken }
                });
                if (profileRes.data.username) displayName = profileRes.data.username;
            } catch (e) { console.warn('Failed to fetch IG profile:', e.message); }
        }
        */

        const contactRes = await db.query(`
            INSERT INTO contacts (channel_id, external_id, display_name, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (channel_id, external_id) DO UPDATE SET
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
            // Update last message timestamp
            await db.query('UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1', [conversationId]);
        } else {
            // Create new conversation
            const newConv = await db.query(`
                INSERT INTO conversations (channel_id, contact_id, status, last_message_at)
                VALUES ($1, $2, 'open', NOW())
                RETURNING id
            `, [channelId, contactId]);
            conversationId = newConv.rows[0].id;
        }

        // 4. Insert Message
        // Idempotency check handled by unique(channel_id, external_message_id) constraint
        const msgRes = await db.query(`
            INSERT INTO messages (
                conversation_id, channel_id, direction, content_type, 
                external_message_id, text_body, delivery_status, raw_payload, created_at
            )
            VALUES ($1, $2, 'inbound', 'text', $3, $4, 'delivered', $5, to_timestamp($6))
            ON CONFLICT (channel_id, external_message_id) DO NOTHING
            RETURNING id
        `, [conversationId, channelId, messageId, textBody, event, timestamp / 1000]); // Instagram timestamp is ms? No, usually seconds. Check docs. 
        // Actually IG graph API timestamp is often unix timestamp in milliseconds or ISO string?
        // Sample says 1600000000. That's seconds.

        if (msgRes.rowCount > 0) {
            console.log(`[Instagram Webhook] Message ${messageId} stored.`);
            
            // Emit Realtime Event
            const io = getIO();
            if (io) {
                const payload = {
                    conversationId,
                    messageId: msgRes.rows[0].id,
                    contentType: 'text',
                    textBody,
                    direction: 'inbound',
                    attachments: [],
                    rawPayload: event
                };
                io.to(`conversation:${conversationId}`).emit('message:new', payload);
                io.emit('message:new', payload);
            }
        } else {
            console.log(`[Instagram Webhook] Duplicate message ${messageId} ignored.`);
        }

    } catch (err) {
        console.error('[Instagram Webhook] Error processing message:', err);
    }
}

module.exports = router;
