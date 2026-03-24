require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/db');
async function run() {
    try {
        const id = '90670b68-3bed-4392-a012-0bfb133fa7a6';
        const res = await db.query('SELECT steps FROM workflows WHERE id = $1', [id]);
        if (res.rowCount === 0) {
            console.log('Workflow not found');
            return;
        }
        console.log(JSON.stringify(res.rows[0].steps, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
