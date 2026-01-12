require('dotenv').config();
const db = require('./db');

async function check() {
  const client = await db.getClient();
  try {
    const users = await client.query('SELECT * FROM users');
    const teams = await client.query('SELECT * FROM teams');
    console.log('Users:', users.rows);
    console.log('Teams:', teams.rows);
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    process.exit();
  }
}

check();
