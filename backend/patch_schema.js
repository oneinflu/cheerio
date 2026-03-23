require('dotenv').config();
const { Pool } = require('pg');

async function patch() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    console.log('Patching DB...');
    await client.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_name TEXT');
    console.log('✅ Added template_name column to messages');
  } catch (e) {
    console.error('❌ Patch failed:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
patch();
