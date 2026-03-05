'use strict';
require('dotenv').config();
const razorpay = require('./src/services/razorpay');

async function testAuth() {
    console.log('Testing Razorpay Auth...');
    console.log('KEY_ID:', process.env.RAZORPAY_KEY_ID);

    try {
        const link = await razorpay.createPaymentLink({
            amount: 1, // 1 INR
            description: 'Auth Test',
            contact: '9999999999',
            email: 'test@example.com',
            notes: { test: true }
        });
        console.log('Success! Link:', link.short_url);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

testAuth();
