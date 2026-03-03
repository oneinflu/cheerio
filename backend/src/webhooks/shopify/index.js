'use strict';
const express = require('express');
const router = express.Router();
const { triggerWorkflowsForEvent } = require('../../services/workflows');

// Helper to determine phone number from Shopify customer data
function extractPhone(customer) {
    if (!customer) return null;
    let phone = customer.phone || customer.default_address?.phone || null;
    if (phone) {
        // Clean up the phone number (remove non-digits except +)
        phone = phone.replace(/[^\d+]/g, '');
        // E.g., if it starts with 0 and is likely Indian, convert to +91
        // Very rudimentary formatting: you would typically use libphonenumber
        if (phone.startsWith('0')) {
            phone = '+91' + phone.substring(1);
        } else if (!phone.startsWith('+')) {
            // Assume Indian if 10 digits
            if (phone.length === 10) phone = '+91' + phone;
        }
    }
    return phone;
}

/**
 * POST /webhooks/shopify
 * Base generic handler for shopify events to trigger workflows
 */
router.post('/', async (req, res, next) => {
    try {
        const hmac = req.header('x-shopify-hmac-sha256');
        const topic = req.header('x-shopify-topic');
        const shop = req.header('x-shopify-shop-domain');

        console.log(`[Shopify Webhook] Received topic: ${topic} from shop: ${shop}`);

        // Typical webhook signature verify step would go here using req.rawBody and SHOPIFY_WEBHOOK_SECRET
        // Since we may not have the secret yet, we will just proceed with the data for now

        const payload = req.body || {};

        // Handle Cart Abandonment or Order Creation
        // Depending on topic, we decide the generic event
        let triggerEvent = 'shopify_events';
        let customer = payload.customer;

        // Some events structure customer data differently
        if (!customer && payload.email) {
            customer = payload;
        }

        const phone = extractPhone(customer);
        const email = customer?.email || payload.email;

        if (phone || email) {
            // Trigger generic shopify event and pass the whole payload as context
            await triggerWorkflowsForEvent(triggerEvent, phone || email, {
                source: 'shopify',
                topic: topic,
                shop: shop,
                data: payload,
                email: email
            });
            console.log(`[Shopify Webhook] Workflow triggered for ${phone || email} on event ${triggerEvent}`);
        } else {
            console.log(`[Shopify Webhook] No phone or email found in payload. Skipping workflow trigger.`);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('[Shopify Webhook] Error:', err);
        res.status(500).send('Error');
    }
});

module.exports = router;
