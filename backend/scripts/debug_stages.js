const { Pool } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('/Users/suuryaprabhat/Desktop/cheerio/backend/.env', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].replace(/"/g, '');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query(`SELECT count(*) FROM contacts`);
    console.log('Total contacts:', res.rows[0].count);
    
    const stages = await pool.query(`SELECT id, name FROM lead_stages`);
    console.log('Lead stages:', stages.rows.map(s => s.name));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

test();
