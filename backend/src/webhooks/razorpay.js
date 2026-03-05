'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const { triggerWorkflowsForEvent } = require('../services/workflows');
const { evaluatePaymentRules } = require('../services/rules');

// Razorpay Webhook to handle payment events
router.post('/', async (req, res) => {
    const payload = req.body;
    const event = payload.event;

    console.log(`[RazorpayWebhook] Received event: ${event}`);

    // In production, verify the webhook signature using process.env.RAZORPAY_WEBHOOK_SECRET
    // For now, we process if it's payment_link.paid

    if (event === 'payment_link.paid') {
        const paymentLink = payload.payload.payment_link.entity;
        const linkId = paymentLink.id;
        const amount = paymentLink.amount / 100; // back to INR
        const notes = paymentLink.notes || {};

        console.log(`[RazorpayWebhook] Payment paid for link ${linkId}, amount: ₹${amount}`);

        try {
            // 1. Update payment_requests table
            const updateRes = await db.query(`
        UPDATE payment_requests
        SET status = 'paid', updated_at = NOW()
        WHERE external_reference = $1
        RETURNING *
      `, [linkId]);

            if (updateRes.rowCount > 0) {
                const paymentRow = updateRes.rows[0];
                const { conversation_id, workflow_id, contact_id } = paymentRow;

                // 2. Fetch phone number for the contact to trigger rules
                const contactRes = await db.query('SELECT external_id FROM contacts WHERE id = $1', [contact_id]);
                if (contactRes.rowCount > 0) {
                    const phoneNumber = contactRes.rows[0].external_id;

                    // 3. Trigger "payment_paid" rules
                    console.log(`[RazorpayWebhook] Triggering rules for payment_paid: ${phoneNumber}`);
                    triggerWorkflowsForEvent('payment_paid', phoneNumber, {
                        amount,
                        workflow_id,
                        request_type: paymentRow.request_type,
                        details: paymentRow.details
                    });

                    // Also evaluate Automation Rules for payment
                    console.log(`[RazorpayWebhook] Evaluating automation rules for payment: ${phoneNumber}`);
                    evaluatePaymentRules(phoneNumber, {
                        amount,
                        request_type: paymentRow.request_type,
                        details: paymentRow.details
                    });
                }
            }
        } catch (err) {
            console.error('[RazorpayWebhook] Error processing payment:', err.message);
        }
    }

    res.status(200).json({ status: 'ok' });
});

module.exports = router;
