require('dotenv').config();
const { Pool } = require('pg');

async function fix() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    console.log('--- REPAIRING MESSAGES SCHEMA ---');
    
    const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'")).rows.map(r => r.column_name);
    console.log('Current columns:', columns.join(', '));

    // 1. ADD missing crucial columns
    if (!columns.includes('template_name')) {
      await client.query('ALTER TABLE messages ADD COLUMN template_name TEXT');
      console.log('✅ Added column: template_name');
    }
    
    if (!columns.includes('external_message_id')) {
        if (columns.includes('external_id')) {
            await client.query('ALTER TABLE messages RENAME COLUMN external_id TO external_message_id');
            console.log('✅ Renamed external_id to external_message_id');
        } else {
            await client.query('ALTER TABLE messages ADD COLUMN external_message_id TEXT');
            console.log('✅ Added column: external_message_id');
        }
    }

    if (!columns.includes('delivery_status')) {
        if (columns.includes('status')) {
            await client.query('ALTER TABLE messages RENAME COLUMN status TO delivery_status');
            console.log('✅ Renamed status to delivery_status');
        } else {
            await client.query('ALTER TABLE messages ADD COLUMN delivery_status TEXT DEFAULT \'sending\'');
            console.log('✅ Added column: delivery_status');
        }
    }

    console.log('--- SCHEMA REPAIR COMPLETE ---');
  } catch (e) {
    console.error('❌ Repair failed:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}
fix();
