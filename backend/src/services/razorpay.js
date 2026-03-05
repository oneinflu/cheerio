'use strict';
const axios = require('axios');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

/**
 * Create a Razorpay Payment Link
 * @param {Object} options 
 * @param {number} options.amount - In paise (e.g. 1000 for ₹10)
 * @param {string} options.description - Link title
 * @param {string} options.contact - Phone number
 * @param {string} options.email - Email address
 * @param {Object} options.notes - Extra metadata
 */
async function createPaymentLink({ amount, description, contact, email, notes }) {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay keys not configured in environment variables');
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            }
        });

        return {
            id: response.data.id,
            short_url: response.data.short_url,
            status: response.data.status
        };
    } catch (err) {
        const errorData = err.response?.data?.error || {};
        console.error('[Razorpay] Failed to create link:', errorData);
        throw new Error(errorData.description || err.message || 'Razorpay link creation failed');
    }
}

module.exports = {
    createPaymentLink
};
