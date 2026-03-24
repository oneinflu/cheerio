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

        // 3. Remove demo seed data (channel +15559999999 and all linked records)
        const demoChannelId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33';
        // Delete messages for demo conversations
        await client.query(`DELETE FROM messages WHERE channel_id = $1`, [demoChannelId]);
        // Delete staff notes for demo conversations
        await client.query(`DELETE FROM staff_notes WHERE conversation_id IN (SELECT id FROM conversations WHERE channel_id = $1)`, [demoChannelId]);
        // Delete conversation assignments for demo conversations
        await client.query(`DELETE FROM conversation_assignments WHERE conversation_id IN (SELECT id FROM conversations WHERE channel_id = $1)`, [demoChannelId]);
        // Delete demo conversations
        await client.query(`DELETE FROM conversations WHERE channel_id = $1`, [demoChannelId]);
        // Delete demo contacts
        await client.query(`DELETE FROM contacts WHERE channel_id = $1`, [demoChannelId]);
        // Delete demo channel itself
        const chRes = await client.query(`DELETE FROM channels WHERE id = $1`, [demoChannelId]);
        console.log(`[ClearWorkflows] Removed demo channel + linked data: ${chRes.rowCount} channel(s) deleted.`);
        
        await client.query('COMMIT');
        console.log('[ClearWorkflows] SUCCESS: Database is now clear of all workflows, demo data, and related logs.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[ClearWorkflows] FAILED to delete workflows:', e.message);
    } finally {
        client.release();
        await db.close();
    }
}

clearAll();
