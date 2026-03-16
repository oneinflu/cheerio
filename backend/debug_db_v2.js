
require('dotenv').config();
const db = require('./db');

async function check() {
  try {
    const settings = await db.query('SELECT * FROM whatsapp_settings');
    console.log('--- WhatsApp Settings ---');
    console.log(JSON.stringify(settings.rows, null, 2));
    
    const channels = await db.query('SELECT * FROM channels');
    console.log('--- Channels ---');
    console.log(JSON.stringify(channels.rows, null, 2));
    
    const convs = await db.query('SELECT c.id, ch.external_id as channel_number, ct.display_name, c.status FROM conversations c JOIN channels ch ON ch.id = c.channel_id JOIN contacts ct ON ct.id = c.contact_id ORDER BY c.created_at DESC LIMIT 20');
    console.log('--- Recent Conversations ---');
    console.log(JSON.stringify(convs.rows, null, 2));

    const msgs = await db.query('SELECT id, conversation_id, direction, text_body, created_at, external_message_id FROM messages ORDER BY created_at DESC LIMIT 20');
    console.log('--- Recent Messages ---');
    console.log(JSON.stringify(msgs.rows, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();
