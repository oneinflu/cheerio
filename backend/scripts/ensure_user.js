
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require("../db");

async function run() {
  try {
    const userId = '69142bedbba19cdff5792706';
    const email = 'shoaib.b@northstaracad.com';
    const name = 'Shoaib Ulla';
    const teamId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';

    await db.query(`
      INSERT INTO users (id, email, name, role, active)
      VALUES ($1, $2, $3, 'agent', true)
      ON CONFLICT (email) DO NOTHING
    `, [userId, email, name]);

    await db.query(`
      INSERT INTO team_members (team_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (team_id, user_id) DO NOTHING
    `, [teamId, userId]);
    
    console.log('User inserted/ensured.');
  } catch (e) {
    console.error(e);
  } finally {
    await db.close();
  }
}
run();
