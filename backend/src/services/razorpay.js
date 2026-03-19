'use strict';
const axios = require('axios');

const db = require('../../db');

/**
 * Get Razorpay credentials for a team
 */
async function getCredentials(teamId) {
    if (!teamId) return {};

    try {
        const result = await db.query(
            'SELECT key_id, key_secret, webhook_secret FROM razorpay_settings WHERE team_id = $1 AND is_active = TRUE',
            [teamId]
        );

        if (result.rowCount > 0) {
            return {
                keyId: result.rows[0].key_id,
                keySecret: result.rows[0].key_secret,
                webhookSecret: result.rows[0].webhook_secret
            };
        }
    } catch (err) {
        console.error('[Razorpay] Error fetching credentials from DB:', err.message);
    }

    return {};
}

/**
 * Create a Razorpay Payment Link
 */
async function createPaymentLink({ teamId, amount, description, contact, email, notes = {} }) {
    const creds = await getCredentials(teamId);

    if (!creds.keyId || !creds.keySecret) {
        throw new Error('Razorpay keys not configured for this team');
    }

    // Ensure teamId is in notes for webhook identification
    if (teamId) {
        notes.teamId = teamId;
    }

    const payload = {
        amount: Math.round(amount * 100), // Convert ₹ to paise
        currency: 'INR',
        accept_partial: false,
        description: description || 'Payment Request',
        customer: {
            name: contact || 'Customer',
            contact: contact || '',
            email: email || ''
        },
        notify: {
            sms: false,
            email: false
        },
        reminder_enable: true,
        notes: notes || {}
    };

    try {
        const response = await axios.post('https://api.razorpay.com/v1/payment_links', payload, {
            auth: {
                username: creds.keyId,
                password: creds.keySecret
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return {
            id: response.data.id,
            short_url: response.data.short_url,
            status: response.data.status
        };
    } catch (err) {
        const errorData = err.response?.data?.error || {};
        const statusCode = err.response?.status;
        console.error(`[Razorpay] API Error (${statusCode}):`, JSON.stringify(errorData, null, 2));

        if (statusCode === 401) {
            throw new Error('Razorpay Authentication failed: Invalid Key ID or Secret');
        }

        throw new Error(errorData.description || err.message || 'Razorpay link creation failed');
    }
}

module.exports = {
    getCredentials,
    createPaymentLink
};
