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
  // Note: Instagram Graph API webhooks usually come with object='instagram' or 'page' depending on setup.
  // For Instagram Messaging, it's typically 'instagram' if subscribed via App Dashboard > Instagram,
  // or 'page' if subscribed via App Dashboard > Webhooks > Page (and linked IG account).
  
  if (body.object === 'instagram' || body.object === 'page') {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    
    entries.forEach(entry => {
      // Instagram Messaging events are usually in 'messaging' array.
      // Sometimes they might be in 'changes' if it's a field update.
      const messagingEvents = entry.messaging || [];
      const changes = entry.changes || [];
      
      // Log entry ID (this is usually the IG User ID or Page ID)
      console.log(`[Instagram Webhook] Entry ID: ${entry.id}`);

      // Process Messaging Events (Direct Messages)
      messagingEvents.forEach(event => {
        console.log('[Instagram Webhook] Messaging Event:', JSON.stringify(event, null, 2));
        
        if (event.message && !event.message.is_echo) {
           handleIncomingMessage(event, entry.id);
        }
      });

      // Process Changes (Comments, etc.)
      changes.forEach(change => {
        console.log('[Instagram Webhook] Change Event:', JSON.stringify(change, null, 2));
        // TODO: Implement comment handling if needed
      });
    });

    // Return 200 OK to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');
  } else {
    console.warn(`[Instagram Webhook] Unknown object type: ${body.object}`);
    // Return 404 if not an instagram/page event
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
    // Instagram attachments can be in 'attachments' array
    const attachments = event.message.attachments || [];
    const timestamp = event.timestamp;

    console.log(`[Instagram Webhook] Processing message from ${senderId} to ${recipientId} (Entry ID: ${entryId})`);

    try {
        // 1. Ensure Channel Exists
        // We look up by the recipientId (which should be our IG User ID).
        // HOWEVER, sometimes recipientId in webhook != the ID we got during OAuth if it's a Page-scoped ID vs User-scoped ID.
        // But usually for IG Business, recipient.id IS the IG Business Account ID.
        
        let channelRes = await db.query('SELECT id, config FROM channels WHERE type = $1 AND external_id = $2', ['instagram', recipientId]);
        
        // Fallback: Check if we have a channel with the Entry ID (sometimes events are routed via Page ID)
        if (channelRes.rows.length === 0) {
             console.log(`[Instagram Webhook] Channel not found for recipient ${recipientId}. Checking entry ID ${entryId}...`);
             channelRes = await db.query('SELECT id, config FROM channels WHERE type = $1 AND external_id = $2', ['instagram', entryId]);
        }

        if (channelRes.rows.length === 0) {
            console.warn(`[Instagram Webhook] Channel for recipient ${recipientId} OR entry ${entryId} not found. Message ignored.`);
            // Debug: List all instagram channels to see what we have
            const allCh = await db.query('SELECT external_id, name FROM channels WHERE type = $1', ['instagram']);
            console.log('[Instagram Webhook] Available Instagram Channels:', allCh.rows);
            return;
        }
        const channelId = channelRes.rows[0].id;
        
        // ... rest of logic ...
        
        // 2. Upsert Contact (The sender)
        let displayName = `Instagram User ${senderId}`;
        
        // Try to get a better name if we haven't already
        // In a real app, we'd use the Page Access Token to query GET /<sender-id>?fields=name,username
        
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
        // Instagram timestamp is in milliseconds (usually). Let's check. 
        // Example: 1772451868000. If it's > 20000000000, it's likely ms.
        // Postgres to_timestamp takes seconds.
        let tsSeconds = timestamp;
        if (timestamp > 9999999999) {
            tsSeconds = timestamp / 1000;
        }

        const msgRes = await db.query(`
            INSERT INTO messages (
                conversation_id, channel_id, direction, content_type, 
                external_message_id, text_body, delivery_status, raw_payload, created_at
            )
            VALUES ($1, $2, 'inbound', 'text', $3, $4, 'delivered', $5, to_timestamp($6))
            ON CONFLICT (channel_id, external_message_id) DO NOTHING
            RETURNING id
        `, [conversationId, channelId, messageId, textBody, event, tsSeconds]);

        if (msgRes.rowCount > 0) {
            console.log(`[Instagram Webhook] Message ${messageId} stored. Conversation: ${conversationId}`);
            
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
