require('dotenv').config();
const db = require('../db');

async function cleanup() {
  console.log('--- Cleaning Up Dummy Test Workflows ---');
  
  try {
    // 1. Find all workflows with 'Verified Test' in the name
    const wfRes = await db.query("SELECT id, name FROM workflows WHERE name LIKE 'Verified Test%'");
    const ids = wfRes.rows.map(r => r.id);

    if (ids.length === 0) {
      console.log('✨ No dummy workflows found to clean up.');
      return;
    }

    console.log(`🗑️ Found ${ids.length} dummy workflows. Deleting...`);

    // 2. Clear mappings from lead_stage_workflows first (foreign key constraint)
    await db.query("DELETE FROM lead_stage_workflows WHERE workflow_id = ANY($1::uuid[])", [ids]);
    console.log('✅ Stage mappings cleared.');

    // 3. Clear workflow runs (if any)
    await db.query("DELETE FROM workflow_runs WHERE workflow_id = ANY($1::uuid[])", [ids]);
    console.log('✅ Execution logs cleared.');

    // 4. Delete the workflows themselves
    await db.query("DELETE FROM workflows WHERE id = ANY($1::uuid[])", [ids]);
    console.log('✅ Workflows deleted.');

    console.log('🚀 CLEANUP COMPLETE!');
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
  } finally {
    await db.close();
  }
}

cleanup();
