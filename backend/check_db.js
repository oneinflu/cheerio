
const db = require('./db');

async function check() {
  try {
    const channels = await db.query('SELECT * FROM channels');
    console.log('Channels:', channels.rows);
    
    const conversations = await db.query('SELECT c.id, ch.external_id as channel_number, ct.display_name FROM conversations c JOIN channels ch ON ch.id = c.channel_id JOIN contacts ct ON ct.id = c.contact_id');
    console.log('Conversations:', conversations.rows);
    
    const settings = await db.query('SELECT * FROM whatsapp_settings');
    console.log('WhatsApp Settings:', settings.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();
