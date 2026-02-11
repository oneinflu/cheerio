'use strict';
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const APP_SECRET = process.env.META_APP_SECRET || '';
const PORT = process.env.PORT || 3000;

const payload = {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "342847945577237",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15556017314",
              "phone_number_id": "342847945577237"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Test User"
                },
                "wa_id": "919182151640"
              }
            ],
            "messages": [
              {
                "from": "919182151640",
                "id": "wamid.HBgMOTE5MTgyMTUxNjQwFQIAEhgUM0E0NjlDN0NBNTNEQzE5QTQwQTYA",
                "timestamp": "1770384271",
                "type": "button",
                "button": {
                  "text": "CPA US",
                  "payload": "CPA US"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
};

async function simulate() {
  try {
    const signature = crypto.createHmac('sha256', APP_SECRET).update(JSON.stringify(payload)).digest('hex');
    
    console.log('Sending webhook payload...');
    const res = await axios.post(`http://localhost:${PORT}/webhooks/whatsapp`, payload, {
      headers: {
        'x-hub-signature-256': `sha256=${signature}`
      }
    });
    
    console.log('Webhook Response:', res.status, res.data);
  } catch (err) {
    console.error('Simulation failed:', err.message);
    if (err.response) {
      console.error('Response:', err.response.status, err.response.data);
    }
  }
}

simulate();
