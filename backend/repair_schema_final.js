require('dotenv').config();
const { Pool } = require('pg');

async function repair() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  
  try {
    console.log('--- REPAIRING ENUMS & COLUMNS ---');

    // 1. Add 'template' to the enum
    try {
      await client.query("ALTER TYPE message_content_type ADD VALUE IF NOT EXISTS 'template'");
      console.log('✅ Added "template" to message_content_type enum');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('ℹ️ "template" already in enum');
      } else {
        console.warn('⚠️ Enum update warning:', e.message);
      }
    }

    // 2. Add 'template_name' column
    try {
      await client.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_name TEXT");
      console.log('✅ Added template_name column');
    } catch (e) {
      console.warn('⚠️ Column update warning:', e.message);
    }

    // 3. Renames and fixes
    try {
      const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'");
      const cols = res.rows.map(r => r.column_name);
      
      if (cols.includes('external_id') && !cols.includes('external_message_id')) {
        await client.query("ALTER TABLE messages RENAME COLUMN external_id TO external_message_id");
        console.log('✅ Renamed external_id');
      }
      
      if (cols.includes('status') && !cols.includes('delivery_status')) {
        await client.query("ALTER TABLE messages RENAME COLUMN status TO delivery_status");
        console.log('✅ Renamed status');
      }
    } catch (e) {
      console.warn('⚠️ Schema check failed:', e.message);
    }

    console.log('--- REPAIR COMPLETE ---');
  } catch (err) {
    console.error('❌ FATAL ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

repair();
