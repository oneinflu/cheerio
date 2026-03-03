require('dotenv').config();
const db = require('./db');

async function check() {
    const res = await db.query('SELECT name FROM workflows');
    console.log(res.rows);
    process.exit(0);
}
check();
