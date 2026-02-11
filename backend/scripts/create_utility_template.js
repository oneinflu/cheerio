'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const whatsappClient = require('../src/integrations/meta/whatsappClient');

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

if (!WABA_ID) {
  console.error('Error: WHATSAPP_BUSINESS_ACCOUNT_ID is missing in .env');
  process.exit(1);
}

async function run() {
  try {
    console.log(`Starting Utility Template Creation for WABA ID: ${WABA_ID}`);

    // 1. Upload a dummy image to get a header handle
    console.log('Step 1: Uploading dummy image for header... SKIPPED (Debugging)');
    /*
    const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64');
    
    let handle;
    try {
      const uploadResult = await whatsappClient.uploadMessageTemplateMedia(
        WABA_ID,
        dummyPng,
        'image/png',
        'header_image.png'
      );
      handle = uploadResult.h;
      console.log('Image uploaded successfully. Handle:', handle);
    } catch (err) {
      console.error('Failed to upload image:', err.message);
      throw err;
    }
    */

    // 2. Define the template payload
    // Use a simple, clean name
    const templateName = `reservation_confirm_${Date.now()}`;
    
    const payload = {
      name: templateName,
      language: "en_US",
      category: "UTILITY", 
      parameter_format: "named",
      components: [
        {
          type: "header",
          format: "TEXT", // Changed to TEXT for testing
          text: "Reservation Confirmed" // Text for header
        },
        {
          type: "body",
          text: "*You're all set!*\n\nYour reservation for {{number_of_guests}} at Lucky Shrub Eatery on {{day}}, {{date}}, at {{time}}, is confirmed. See you then!",
          example: {
            body_text_named_params: [
              { param_name: "number_of_guests", example: "4" },
              { param_name: "day", example: "Saturday" },
              { param_name: "date", example: "August 30th, 2025" },
              { param_name: "time", example: "7:30 pm" }
            ]
          }
        },
        {
          type: "footer",
          text: "Lucky Shrub Eatery: The Luckiest Eatery in Town!"
        },
        {
          type: "buttons",
          buttons: [
            {
              type: "url",
              text: "Change reservation",
              url: "https://www.luckyshrubeater.com/reservations"
            },
            {
              type: "phone_number",
              text: "Call us",
              phone_number: "+16505551234"
            },
            {
              type: "quick_reply",
              text: "Cancel reservation"
            }
          ]
        }
      ]
    };

    console.log('Step 2: Creating template:', templateName);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const result = await whatsappClient.createTemplate(WABA_ID, payload);
    console.log('Template created successfully!');
    console.log('Response:', JSON.stringify(result.data, null, 2));

  } catch (err) {
    console.error('Failed to create template.');
    console.error('Error:', err.message);
    if (err.response) {
      console.error('API Response:', JSON.stringify(err.response, null, 2));
    }
  }
}

run();
