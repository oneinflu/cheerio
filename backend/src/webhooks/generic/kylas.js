'use strict';
const express = require('express');
const router = express.Router();
const { triggerWorkflowsForEvent } = require('../../services/workflows');

// Very similar to incoming webhook but tailored logic.
router.post('/', async (req, res, next) => {
    try {
        const payload = req.body || {};
        console.log(`[Kylas Webhook] Received payload keys: ${Object.keys(payload).join(', ')}`);
        
        let triggerEvent = 'kylas_event_create';
        // Mock identifying standard update action vs create
        if (payload.action && payload.action.toLowerCase() === 'update') {
            triggerEvent = 'kylas_event_update';
        }

        const lead = payload.lead || payload.contact || payload;
        let phone = lead.phone || lead.mobile || lead.phoneNumbers?.[0] || null;

        if (phone) {
            phone = phone.replace(/[^\d+]/g, '');
            console.log(`[Kylas Webhook] Processing for phone ${phone}`);
            await triggerWorkflowsForEvent(triggerEvent, phone, payload);
            res.status(200).send({ success: true, message: `Workflow ${triggerEvent} triggered` });
        } else {
             console.log(`[Kylas Webhook] No identifiable phone number in payload.`);
             res.status(400).send({ success: false, message: 'No valid phone number field found' });
        }
    } catch (err) {
        console.error('[Kylas Webhook] Error:', err);
        res.status(500).send('Error');
    }
});

module.exports = router;
