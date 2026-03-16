
require('dotenv').config();
const db = require('./db');

async function check() {
  try {
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Database URL exists:', !!process.env.DATABASE_URL);
    
    const settings = await db.query('SELECT team_id, phone_number_id, display_phone_number FROM whatsapp_settings');
    console.log('--- WhatsApp Settings ---');
    console.table(settings.rows);
    
    const channels = await db.query('SELECT id, name, type, external_id FROM channels');
    console.log('--- Channels ---');
    console.table(channels.rows);
    
    const convs = await db.query('SELECT c.id, ch.external_id as channel_number, ct.display_name, c.status FROM conversations c JOIN channels ch ON ch.id = c.channel_id JOIN contacts ct ON ct.id = c.contact_id ORDER BY c.created_at DESC LIMIT 10');
    console.log('--- Recent Conversations ---');
    console.table(convs.rows);

    const msgs = await db.query('SELECT conversation_id, direction, text_body, created_at FROM messages ORDER BY created_at DESC LIMIT 10');
    console.log('--- Recent Messages ---');
    console.table(msgs.rows);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();
