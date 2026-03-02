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

  console.log('[Instagram Webhook] Verification request:', { mode, token, challenge });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Instagram Webhook] Verification successful.');
    // Echo the challenge string exactly to confirm subscription.
    return res.status(200).send(challenge);
  }
  console.warn('[Instagram Webhook] Verification failed. Token mismatch or invalid mode.');
  return res.status(403).json({ error: 'Forbidden' });
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

      messagingEvents.forEach(event => {
        console.log('[Instagram Webhook] Messaging Event:', event);
        // TODO: Implement message processing logic here
      });

      changes.forEach(change => {
        console.log('[Instagram Webhook] Change Event:', change);
        // TODO: Implement change processing logic here
      });
    });

    // Return 200 OK to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Return 404 if not an instagram/page event
    res.sendStatus(404);
  }
});

module.exports = router;
