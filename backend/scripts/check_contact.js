'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../db');

async function checkContact() {
  try {
    const res = await db.query(
      `SELECT external_id, profile FROM contacts WHERE external_id = $1`,
      ['919182151640']
    );
    console.log('Contact Profile:', JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

checkContact();
