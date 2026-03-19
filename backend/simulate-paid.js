require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_secret';
const plink_id = process.argv[2];

if (!plink_id) {
  console.log('Usage: node simulate-paid.js plink_xxxxxxxxxxxxxx');
  process.exit(1);
}

const payload = {
  event: 'payment_link.paid',
  payload: {
    payment_link: {
      entity: {
        id: plink_id,
        status: 'paid',
        notes: {
          teamId: 'default',
          workflow_id: 'test-wf',
          contact_id: 'test-contact'
        }
      }
    }
  }
};

const hmac = crypto.createHmac('sha256', webhookSecret);
const signature = hmac.update(JSON.stringify(payload)).digest('hex');

async function testWebhook() {
  try {
    const res = await axios.post('http://localhost:3000/webhooks/razorpay', payload, {
      headers: {
        'x-razorpay-signature': signature
      }
    });

    console.log('--- Webhook Simulation Result ---');
    console.log('Status Code:', res.status);
    console.log('Response Body:', res.data);
    console.log('✅ Success! Backend received the "paid" event and should now trigger logic.');
  } catch (err) {
    console.error('❌ Failed to simulate webhook:', err.response?.data || err.message);
  }
}

testWebhook();
