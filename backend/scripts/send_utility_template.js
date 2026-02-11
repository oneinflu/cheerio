const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const whatsappClient = require('../src/integrations/meta/whatsappClient');

// CONFIGURATION
// The template we found: reservation_confirm_1770380392757
// (If you want to use a different one, update this)
const TEMPLATE_NAME = 'reservation_confirmation_1770379949709'; 
const LANGUAGE_CODE = 'en_US';

// RECIPIENT PHONE NUMBER
// REPLACE THIS with the actual phone number you want to test with (must be in your allowed list for test accounts)
const RECIPIENT_PHONE = process.env.TEST_PHONE_NUMBER || '919182151640';

async function run() {
  try {
    console.log(`Preparing to send utility template: ${TEMPLATE_NAME}`);
    console.log(`To: ${RECIPIENT_PHONE}`);

    // Define the components (parameters) required by the template
    // Based on the creation script, the body params are: number_of_guests, day, date, time.
    const components = [
      {
        type: 'body',
        parameters: [
          {
            type: 'text',
            parameter_name: 'number_of_guests',
            text: '4'
          },
          {
            type: 'text',
            parameter_name: 'day',
            text: 'Saturday'
          },
          {
            type: 'text',
            parameter_name: 'date',
            text: 'August 30th, 2025'
          },
          {
            type: 'text',
            parameter_name: 'time',
            text: '7:30 pm'
          }
        ]
      }
    ];

    // Note: Our template has a static TEXT header, so no header component params are needed.
    // If it had an IMAGE header, we would need:
    // {
    //   type: 'header',
    //   parameters: [
    //     { type: 'image', image: { id: 'MEDIA_ID' } }
    //   ]
    // }

    console.log('Sending payload components:', JSON.stringify(components, null, 2));

    // Fallback ID found in source code if env var is missing
    const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '342847945577237';

    const res = await whatsappClient.sendTemplate(
      PHONE_ID,
      RECIPIENT_PHONE,
      TEMPLATE_NAME,
      LANGUAGE_CODE,
      components
    );

    console.log('Template sent successfully!');
    console.log('Response:', JSON.stringify(res.data, null, 2));

  } catch (err) {
    console.error('Failed to send template.');
    console.error('Error Message:', err.message);
    if (err.response) {
      console.error('API Response Error:', JSON.stringify(err.response, null, 2));
    }
  }
}

run();
