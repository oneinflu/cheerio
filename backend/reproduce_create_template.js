const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const whatsappClient = require('./src/integrations/meta/whatsappClient');

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

async function run() {
  const payload = { 
     "name": "testing_test_repro_" + Date.now(), 
     "category": "MARKETING", 
     "language": "en_US", 
     "components": [ 
         { 
             "type": "BODY", 
             "text": "Hello {{name}}, check out our latest offers! {{phone}} call us.", 
             "example": { 
                 "body_text_named_params": [ 
                     { 
                         "param_name": "name", 
                         "example": "John" 
                     }, 
                     { 
                         "param_name": "phone", 
                         "example": "918151640" 
                     } 
                 ] 
             } 
         }, 
         { 
             "type": "BUTTONS", 
             "buttons": [ 
                 { 
                     "type": "QUICK_REPLY", 
                     "text": "Im Intrested" 
                 } 
             ] 
         } 
     ], 
     "parameter_format": "NAMED" 
 };

  console.log('Sending payload:', JSON.stringify(payload, null, 2));

  try {
    const res = await whatsappClient.createTemplate(WABA_ID, payload);
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Full Error:', JSON.stringify(err, null, 2));
    if (err.response) {
        console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

run();
