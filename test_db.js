require('/Users/suuryaprabhat/Desktop/cheerio/backend/node_modules/dotenv').config({ path: '/Users/suuryaprabhat/Desktop/cheerio/backend/.env' });
const db = require('/Users/suuryaprabhat/Desktop/cheerio/backend/db');
async function test() {
  try {
    console.log('Testing DB connection...');
    const res = await db.query('SELECT 1 + 1 AS result');
    console.log('Success:', res.rows[0]);
  } catch (e) {
    console.error('Failed:', e.message);
  } finally {
    await db.close();
  }
}
test();
