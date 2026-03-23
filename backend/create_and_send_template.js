'use strict';
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

/**
 * Script: Create & Send Marketing Template
 * 1. Uploads local image from ./files/image.png to Meta
 * 2. Creates a MARKETING template with the image as a header
 * 3. Polls until Meta approves the template (usually < 2 min)
 * 4. Sends the template to +919182151640
 */

// Configuration from .env
const TOKEN = process.env.WHATSAPP_TOKEN;
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const APP_ID = process.env.META_APP_ID;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const RECIPIENT = '919182151640';
const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

// Path to your image - check both relative and absolute paths for robustness
const IMAGE_PATH = path.join(__dirname, 'files', 'image.png');

async function run() {
  console.log('🚀 Starting Template Creation Process...');

  try {
    if (!fs.existsSync(IMAGE_PATH)) {
      throw new Error(`Image not found at ${IMAGE_PATH}. Please ensure the file exists in the backend/files folder.`);
    }

    // --- STEP 1: Upload Image to Meta to get a Handle ---
    console.log('📤 Uploading image to Meta...');
    const stats = fs.statSync(IMAGE_PATH);
    const buffer = fs.readFileSync(IMAGE_PATH);

    // Start upload session
    const startRes = await axios.post(`${GRAPH_BASE}/${APP_ID}/uploads`, null, {
      params: {
        file_name: 'promo_marketing.png',
        file_length: stats.size,
        file_type: 'image/png',
        access_token: TOKEN,
      },
    });

    const uploadId = startRes.data.id;

    // Binary upload for the media handle
    const uploadRes = await axios.post(`${GRAPH_BASE}/${uploadId}`, buffer, {
      headers: {
        Authorization: `OAuth ${TOKEN}`,
        'file_offset': 0,
        'Content-Type': 'application/octet-stream'
      },
    });

    const handle = uploadRes.data.h;
    if (!handle) throw new Error('Failed to obtain media handle from Meta.');
    console.log('✅ Image handle obtained for creation.');

    // --- STEP 2: Upload to Meta Media Store (for Sending) ---
    console.log('📤 Uploading image to Media Store (for sending)...');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', buffer, { filename: 'promo.png', contentType: 'image/png' });
    form.append('type', 'image/png');

    const mediaStoreRes = await axios.post(`${GRAPH_BASE}/${PHONE_ID}/media`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    const mediaId = mediaStoreRes.data.id;
    console.log('✅ Media ID obtained:', mediaId);

    // --- STEP 3: Create Marketing Template ---
    const templateName = 'marketing_image_promo_' + Math.floor(Date.now() / 1000);
    console.log(`📝 Creating marketing template: ${templateName}...`);

    const templateData = {
      name: templateName,
      category: 'MARKETING',
      language: 'en_US',
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: { header_handle: [handle] }
        },
        {
          type: 'BODY',
          text: 'Exclusive Marketing Offer! Our latest collection is now live. Click below to explore these limited-time deals!'
        },
        {
          type: 'FOOTER',
          text: 'Powered by Greeto'
        },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'View Offers' },
            { type: 'QUICK_REPLY', text: 'Not Interested' }
          ]
        }
      ]
    };

    await axios.post(`${GRAPH_BASE}/${WABA_ID}/message_templates`, templateData, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log('✅ Template created successfully.');

    // --- STEP 4: Poll for Approval ---
    console.log('⏳ Waiting for Meta Approval (polling every 15s)...');
    let status = 'PENDING';
    let attempts = 0;

    while (status === 'PENDING' && attempts < 10) {
      await new Promise(r => setTimeout(r, 15000));
      const statusRes = await axios.get(`${GRAPH_BASE}/${WABA_ID}/message_templates`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        params: { name: templateName }
      });

      const tpl = statusRes.data.data.find(t => t.name === templateName);
      status = tpl ? tpl.status : 'NOT_FOUND';
      attempts++;
      console.log(`Current Status: ${status} (Attempt ${attempts}/10)`);
    }

    if (status !== 'APPROVED') {
      console.log('Status is not APPROVED, but trying to send anyway as test number might work...');
    }

    // --- STEP 5: Send to Recipient WITH Component Parameters ---
    console.log(`📲 Sending message with Image Component to ${RECIPIENT}...`);
    const sendRes = await axios.post(`${GRAPH_BASE}/${PHONE_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: RECIPIENT,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en_US' },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: { id: mediaId }
              }
            ]
          }
        ]
      }
    }, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    console.log('🎉 COMPLETED! Message ID:', sendRes.data.messages[0].id);

    // --- STEP 6: Log to Local Database for Reporting ---
    console.log('💾 Logging sent message to local database for reports...');
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      // 1. Ensure conversation exists
      let convRes = await pool.query('SELECT id FROM conversations WHERE contact_id = (SELECT id FROM contacts WHERE external_id = $1 OR external_id = $2 LIMIT 1) LIMIT 1', [RECIPIENT, '+' + RECIPIENT]);
      let conversationId;
      
      if (convRes.rowCount > 0) {
        conversationId = convRes.rows[0].id;
      } else {
        // Create minimal contact/conversation if not found
        const contactInsert = await pool.query('INSERT INTO contacts (external_id, display_name) VALUES ($1, $2) ON CONFLICT (external_id) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id', [RECIPIENT, 'Test Contact']);
        const contactId = contactInsert.rows[0].id;
        const channelRes = await pool.query('SELECT id FROM channels WHERE external_id = $1 LIMIT 1', [PHONE_ID]);
        const channelId = channelRes.rows[0]?.id;
        const convInsert = await pool.query('INSERT INTO conversations (contact_id, channel_id) VALUES ($1, $2) RETURNING id', [contactId, channelId]);
        conversationId = convInsert.rows[0].id;
      }

      // 2. Insert message with template_name so it shows in template report
      const channelRes = await pool.query('SELECT channel_id FROM conversations WHERE id = $1', [conversationId]);
      const channelId = channelRes.rows[0]?.channel_id;

      await pool.query(`
        INSERT INTO messages (
          conversation_id, channel_id, direction, content_type, text_body, 
          external_message_id, template_name, delivery_status, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        conversationId, channelId, 'outbound', 'template', 
        'Marketing offer sent via script',
        sendRes.data.messages[0].id, templateName, 'sent'
      ]);

      console.log('✅ Message logged to database. It will now show up in Reports!');
    } catch (dbErr) {
      console.warn('⚠️ Failed to log to local database (Reports might not show this run):', dbErr.message);
    } finally {
      await pool.end();
    }

  } catch (err) {
    const apiMsg = err.response?.data?.error?.message || err.message;
    console.error('❌ Error occurred:', apiMsg);
    if (err.response?.data) {
      console.error('Response Details:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

run();
