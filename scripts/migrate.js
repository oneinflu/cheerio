'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const db = require('../db');

async function runSQLFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
}

async function main() {
  const client = await db.getClient();
  try {
    console.log('[migrate] Starting migration using DATABASE_URL');
    await client.query('BEGIN');
    await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0001_meta_command_center.sql'));
    await client.query('COMMIT');
    console.log('[migrate] Migration applied successfully');

    console.log('[seed] Applying seed data');
    await client.query('BEGIN');
    await runSQLFile(client, path.join(__dirname, '..', 'db', 'seeds', '001_demo_data.sql'));
    await client.query('COMMIT');
    console.log('[seed] Seed data applied successfully');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('[migrate] Error:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.close();
  }
}

main();

