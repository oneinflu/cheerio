const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../db');

async function deleteAllWorkflows() {
  console.log('Starting deletion of all workflows...');
  
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // Delete payment_requests first as they reference workflows
    console.log('Deleting payment_requests...');
    const payRes = await client.query('DELETE FROM payment_requests');
    console.log(`Deleted ${payRes.rowCount} payment requests.`);

    // Delete workflows
    console.log('Deleting workflows...');
    const wfRes = await client.query('DELETE FROM workflows');
    console.log(`Deleted ${wfRes.rowCount} workflows.`);

    await client.query('COMMIT');
    console.log('All workflows deleted successfully.');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error during rollback:', rollbackErr);
    }
    console.error('Error deleting workflows:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

deleteAllWorkflows();
