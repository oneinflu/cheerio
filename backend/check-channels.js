require('dotenv').config();
const db = require('./db');

async function checkChannels() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  try {
    const res = await db.query('SELECT * FROM channels;');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkChannels();
