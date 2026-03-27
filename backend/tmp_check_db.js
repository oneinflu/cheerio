const db = require('./db');
async function check() {
  try {
    const res = await db.query('SELECT * FROM lead_stage_workflows LIMIT 20');
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
