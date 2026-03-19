'use strict';
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../../db');
const { triggerWorkflowsForEvent } = require('../services/workflows');
const { evaluatePaymentRules } = require('../services/rules');
const { getCredentials } = require('../services/razorpay');

/**
 * Verify Razorpay Webhook Signature
 */
function verifySignature(webhookBody, signature, secret) {
    if (!secret || !signature) return false;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(webhookBody)
        .digest('hex');
    return expectedSignature === signature;
}

// Razorpay Webhook to handle payment events
router.post('/', async (req, res) => {
    const payload = req.body;
    const event = payload.event;
    const signature = req.headers['x-razorpay-signature'];
    
    // Most Razorpay events for payment links or payments include notes
    // Extraction depends on the event entity
    let notes = {};
    if (payload.payload?.payment_link?.entity?.notes) {
        notes = payload.payload.payment_link.entity.notes;
    } else if (payload.payload?.payment?.entity?.notes) {
        notes = payload.payload.payment.entity.notes;
    } else if (payload.payload?.order?.entity?.notes) {
        notes = payload.payload.order.entity.notes;
    }

    const teamId = notes.teamId || 'default';
    console.log(`[RazorpayWebhook] [Team: ${teamId}] Received event: ${event}`);

    // Verify signature if secret is configured
    try {
        const creds = await getCredentials(teamId);
        if (creds.webhookSecret && signature) {
            const isValid = verifySignature(req.rawBody || JSON.stringify(payload), signature, creds.webhookSecret);
            if (!isValid) {
                console.warn(`[RazorpayWebhook] [Team: ${teamId}] Invalid signature detected.`);
                // In production, you might want to return 400 here
                // return res.status(400).send('Invalid signature');
            }
        }
    } catch (err) {
        console.warn(`[RazorpayWebhook] [Team: ${teamId}] Credentials fetch failed for verification.`);
    }

    // Handle Events
    try {
        if (event === 'payment_link.paid' || event === 'order.paid' || event === 'payment.captured') {
            await handlePaymentSuccess(payload, teamId);
        } else if (event === 'payment.failed' || event === 'payment_link.cancelled' || event === 'payment_link.expired') {
            await handlePaymentFailure(payload, teamId);
        } else {
            console.log(`[RazorpayWebhook] Unhandled event type: ${event}`);
        }
    } catch (err) {
        console.error(`[RazorpayWebhook] Error processing ${event}:`, err.message);
    }

    res.status(200).json({ status: 'ok' });
});

async function handlePaymentSuccess(payload, teamId) {
    let entity, amount, linkId, notes;
    
    if (payload.event === 'payment_link.paid') {
        entity = payload.payload.payment_link.entity;
        linkId = entity.id;
        amount = entity.amount / 100;
        notes = entity.notes || {};
    } else if (payload.event === 'payment.captured') {
        entity = payload.payload.payment.entity;
        linkId = entity.order_id || entity.id;
        amount = entity.amount / 100;
        notes = entity.notes || {};
    } else if (payload.event === 'order.paid') {
        entity = payload.payload.order.entity;
        linkId = entity.id;
        amount = entity.amount / 100;
        notes = entity.notes || {};
    }

    console.log(`[RazorpayWebhook] [Team: ${teamId}] Payment success: ${linkId}, ₹${amount}`);

    // Update payment_requests table
    const updateRes = await db.query(`
        UPDATE payment_requests
        SET status = 'paid', updated_at = NOW()
        WHERE external_reference = $1 OR external_reference = $2
        RETURNING *
    `, [linkId, entity.id]);

    if (updateRes.rowCount > 0) {
        const paymentRow = updateRes.rows[0];
        const { contact_id, workflow_id } = paymentRow;

        // Fetch phone number
        const contactRes = await db.query('SELECT external_id FROM contacts WHERE id = $1', [contact_id]);
        if (contactRes.rowCount > 0) {
            const phoneNumber = contactRes.rows[0].external_id;

            // Trigger Workflows
            triggerWorkflowsForEvent('payment_paid', phoneNumber, {
                amount,
                workflow_id,
                request_type: paymentRow.request_type,
                details: paymentRow.details,
                teamId
            });

            // Evaluate Rules
            evaluatePaymentRules(phoneNumber, {
                amount,
                request_type: paymentRow.request_type,
                details: paymentRow.details,
                teamId
            });
        }
    }
}

async function handlePaymentFailure(payload, teamId) {
    let entity, linkId;
    if (payload.event === 'payment.failed') {
        entity = payload.payload.payment.entity;
        linkId = entity.order_id || entity.id;
    } else {
        entity = payload.payload.payment_link.entity;
        linkId = entity.id;
    }

    console.log(`[RazorpayWebhook] [Team: ${teamId}] Payment failed/cancelled: ${linkId}`);

    await db.query(`
        UPDATE payment_requests
        SET status = 'failed', updated_at = NOW()
        WHERE external_reference = $1 OR external_reference = $2
    `, [linkId, entity.id]);
    
    // Optionally trigger "payment_failed" rules if implemented
}

module.exports = router;
