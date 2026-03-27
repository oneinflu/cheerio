const db = require('./db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const workflows = require('./src/services/workflows');

async function manualTrigger(phoneNumber, stageName) {
    try {
        // 1. Find Stage
        const stageRes = await db.query('SELECT id, name FROM lead_stages WHERE name ILIKE $1 LIMIT 1', [stageName]);
        if (stageRes.rowCount === 0) {
            console.log(`❌ Stage "${stageName}" not found.`);
            return;
        }
        const stageId = stageRes.rows[0].id;
        console.log(`✅ Stage: ${stageRes.rows[0].name} (${stageId})`);

        // 2. Ensure contact exists (Simulate new contact join or stage change)
        console.log(`\n⏳ Simulating initial trigger for ${phoneNumber}...`);
        
        // We call runStageWorkflows directly
        await workflows.runStageWorkflows(stageId, phoneNumber);
        
        console.log(`\n🚀 Workflow Orchestration INITIATED for ${phoneNumber}.`);
        console.log(`\n--- NEXT STEPS ---`);
        console.log(`1. Run 'node diagnose_drip.js ${phoneNumber} "${stageName}"' to see the newly scheduled task.`);
        console.log(`2. Wait 1 minute for the background worker to pick up ANY 'completed' tasks.`);
        console.log(`3. If the task has a delay (e.g. 5m), it will NOT run immediately.`);
        
    } catch (e) {
        console.error("Trigger Failed:", e);
    } finally {
        await db.close();
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Usage: node trigger_drip.js <phone> <stageName>");
    process.exit(1);
}
manualTrigger(args[0], args[1]);
