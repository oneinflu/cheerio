'use strict';
require('dotenv').config();
const db = require('../db');

async function clearAll() {
    console.log('[ClearWorkflows] Proceeding to delete all workflows from the database...');
    
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        
        // 1. Optional: Clear related events first if there are foreign keys
        // (usually better to use CASCADE but explicit is safer for logs)
        const eventsRes = await client.query('DELETE FROM webhook_events');
        console.log(`[ClearWorkflows] Deleted ${eventsRes.rowCount} webhook events.`);

        const csatRes = await client.query('DELETE FROM csat_scores');
        console.log(`[ClearWorkflows] Deleted ${csatRes.rowCount} csat scores.`);

        const paymentRes = await client.query('DELETE FROM payment_requests');
        console.log(`[ClearWorkflows] Deleted ${paymentRes.rowCount} payment requests.`);

        const reportsRes = await client.query('DELETE FROM workflow_runs');
        console.log(`[ClearWorkflows] Deleted ${reportsRes.rowCount} execution reports.`);

        const stageRes = await client.query('DELETE FROM lead_stage_workflows');
        console.log(`[ClearWorkflows] Deleted ${stageRes.rowCount} lead stage workflow links.`);
        
        // 2. Clear workflows
        const res = await client.query('DELETE FROM workflows');
        console.log(`[ClearWorkflows] Deleted ${res.rowCount} workflows.`);
        
        await client.query('COMMIT');
        console.log('[ClearWorkflows] SUCCESS: Database is now clear of all workflows and related logs.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[ClearWorkflows] FAILED to delete workflows:', e.message);
    } finally {
        client.release();
        await db.close();
    }
}

clearAll();
