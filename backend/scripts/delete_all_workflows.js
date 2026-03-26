require('dotenv').config();
const db = require('../db');

/**
 * ⚠️ WARNING: THIS SCRIPT DELETES ALL WORKFLOWS PERMANENTLY.
 * Use this only if you want a complete reset of your automation system.
 */
async function deleteAllWorkflows() {
  console.log('🚮 DANGER: PERMANENTLY DELETING ALL WORKFLOWS...');
  
  try {
    // 1. Clear Stage Mappings (Drip Funnels)
    await db.query("DELETE FROM lead_stage_workflows");
    console.log('✅ All drip sequences cleared.');

    // 2. Clear Workflow Runs (History)
    await db.query("DELETE FROM workflow_runs");
    console.log('✅ All workflow history cleared.');

    // 3. Delete All Workflows
    const res = await db.query("DELETE FROM workflows RETURNING id");
    console.log(`✅ ${res.rowCount} workflows permanently deleted.`);

    console.log('🚀 SYSTEM RESET COMPLETE!');
  } catch (err) {
    console.error('❌ Reset failed:', err);
  } finally {
    await db.close();
  }
}

deleteAllWorkflows();
