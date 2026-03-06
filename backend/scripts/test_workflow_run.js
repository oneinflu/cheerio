'use strict';
require('dotenv').config();
const db = require('../db');
const { runWorkflow } = require('../src/services/workflows');

// The number provided by user
const TEST_PHONE = '919182151640';

async function testRun() {
  const client = await db.getClient();
  try {
    console.log(`Starting Test Run for ${TEST_PHONE}...`);

    // 1. Find the CMA USA Workflow
    const wfRes = await client.query(`SELECT id, name FROM workflows WHERE name = 'CMA USA Drip Campaign' LIMIT 1`);
    if (wfRes.rowCount === 0) {
      console.error('CMA USA Drip Campaign workflow not found! Did you run the seed script?');
      process.exit(1);
    }
    const workflowId = wfRes.rows[0].id;
    console.log(`Found Workflow: ${wfRes.rows[0].name} (${workflowId})`);

    // 2. Ensure Contact exists (to avoid 'contact not found' errors in runner)
    // The runner usually does this, but let's be explicit for the test harness.
    // We don't know the channel_id easily without querying channels, so we let the runner handle ensureConversation.
    
    // 3. Trigger the Workflow
    console.log('Triggering workflow...');
    
    // We call runWorkflow directly. 
    // Note: runWorkflow is async and might take time due to delays, but the first steps should happen immediately.
    // However, since it has a 24-hour delay, we won't see completion here. We just want to see it START and send the first template.
    
    // Mock context if needed
    const context = { source: 'manual_test' };
    
    // Run!
    await runWorkflow(workflowId, TEST_PHONE, context);
    
    console.log('Workflow execution initiated successfully.');
    console.log('Check your WhatsApp for the "cma_welcome_v1" template message.');

  } catch (err) {
    console.error('Test Run Failed:', err);
  } finally {
    client.release();
    await db.close();
  }
}

testRun();
