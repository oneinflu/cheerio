const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const whatsappClient = require('../src/integrations/meta/whatsappClient');

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

async function run() {
  try {
    console.log('Fetching templates for WABA ID:', WABA_ID);
    const res = await whatsappClient.getTemplates(WABA_ID, 5); // Get last 5
    // Log the templates to find the one we just created
    if (res.data && res.data.data) {
        const templates = res.data.data;
        console.log('Found templates:', templates.length);
        templates.forEach(t => {
            console.log(`- Name: ${t.name}, Status: ${t.status}, Category: ${t.category}`);
        });
    } else {
        console.log('No templates found or bad structure:', res);
    }
  } catch (err) {
    console.error('Error fetching templates:', err.message);
    if (err.response) {
      console.error('Details:', JSON.stringify(err.response, null, 2));
    }
  }
}

run();
