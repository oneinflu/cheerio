'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../db');

async function check() {
  try {
    // Check column existence
    const colRes = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='conversations' AND column_name='lead_id'");
    console.log('Column lead_id exists:', colRes.rows.length > 0);

    // Check specific conversation
    const convId = 'd65a7ef3-d7d9-4876-ba63-22aa2b8bf866';
    const convRes = await db.query('SELECT id, lead_id FROM conversations WHERE id = $1', [convId]);
    
    if (convRes.rows.length === 0) {
        console.log('Conversation not found');
        return;
    }

    console.log('Current Conversation Data:', convRes.rows[0]);

    // Update it if null
    if (!convRes.rows[0].lead_id) {
       console.log('lead_id is null. Updating with test ID...');
       await db.query('UPDATE conversations SET lead_id = $1 WHERE id = $2', ['683d8d635c519289e933cc70', convId]);
       const updated = await db.query('SELECT id, lead_id FROM conversations WHERE id = $1', [convId]);
       console.log('Updated Data:', updated.rows[0]);
    }
  } catch (e) { console.error(e); }
  finally { await db.close(); }
}
check();
