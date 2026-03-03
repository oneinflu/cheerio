'use strict';
const express = require('express');
const router = express.Router();
const { triggerWorkflowsForEvent } = require('../../services/workflows');

/**
 * GET /webhooks/incoming
 * Verify incoming webhook from Generic source
 */
router.get('/', (req, res) => {
    // Return challenge if present for verification logic (some generic webhooks require a 200 OK or echo challenge)
    const challenge = req.query.challenge || req.query.hub?.challenge;
    if (challenge) {
        return res.status(200).send(challenge);
    }
    return res.status(200).send('Webhook Endpoint Active');
});

/**
 * POST /webhooks/incoming
 * A generic catch-all incoming webhook suitable for simple POST interactions with structured JSON
 */
router.post('/', async (req, res, next) => {
    try {
        const payload = req.body || {};

        console.log(`[Generic Webhook] Received payload keys: ${Object.keys(payload).join(', ')}`);

        let triggerEvent = 'incoming_webhook';
        let phone = payload.phone || payload.phone_number || payload.mobile || payload.whatsapp;

        if (payload.event_type || payload.type) {
            console.log(`[Generic Webhook] Event Type detected as: ${payload.event_type || payload.type}`);
        }

        if (phone) {
            // Very rudimentary phone sanitation
            phone = phone.replace(/[^\d+]/g, '');
            if (phone.length === 10 && !phone.startsWith('+')) {
                phone = '+91' + phone;
            } else if (phone.startsWith('91') && phone.length === 12) {
                // Ensure it's treated exactly as expected by generic rules
                phone = '+' + phone;
            }

            console.log(`[Generic Webhook] Processing for phone ${phone}`);
            await triggerWorkflowsForEvent(triggerEvent, phone, payload);
            res.status(200).send({ success: true, message: 'Workflow triggered' });
        } else {
            console.log(`[Generic Webhook] No identifiable phone number in payload.`);
            res.status(400).send({ success: false, message: 'No valid phone number field (phone, phone_number, mobile, whatsapp) found' });
        }
    } catch (err) {
        console.error('[Generic Webhook] Error:', err);
        res.status(500).send('Error');
    }
});

module.exports = router;
