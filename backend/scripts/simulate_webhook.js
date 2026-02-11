const axios = require('axios');
const crypto = require('crypto');

const APP_SECRET = process.env.META_APP_SECRET || 'test_secret';
const PORT = process.env.PORT || 3000;

async function run() {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123456789',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550051234',
                phone_number_id: '100000000000001'
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User'
                  },
                  wa_id: '15551234567'
                }
              ],
              messages: [
                {
                  from: '15551234567',
                  id: 'wamid.HBgLMTU1NTEyMzQ1NjcVAgASGBQzQjE0NTJFB...=' + Date.now(),
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: {
                    body: 'Hello from simulation ' + new Date().toISOString()
                  },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  const body = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');

  try {
    const res = await axios.post(`http://localhost:${PORT}/webhooks/whatsapp`, payload, {
      headers: {
        'x-hub-signature-256': signature,
        'Content-Type': 'application/json'
      }
    });
    console.log('Webhook response:', res.status, res.data);
  } catch (err) {
    console.error('Webhook failed:', err.response ? err.response.data : err.message);
  }
}

run();
