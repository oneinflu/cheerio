'use strict';
const express = require('express');
const router = express.Router();
const razorpay = require('../services/razorpay');

// POST /api/payments/create-link
router.post('/create-link', async (req, res, next) => {
    try {
        const { amount, description, contact, email, notes } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        const teamId = req.query.teamId || (req.user && req.user.teamIds && req.user.teamIds[0]);

        const payLink = await razorpay.createPaymentLink({
            teamId,
            amount: parseFloat(amount),
            description: description || 'Payment Request',
            contact: contact || '',
            email: email || '',
            notes: notes || {}
        });

        res.json(payLink);
    } catch (err) {
        console.error('[PaymentsRoute] Error creating link:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
