'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');

/**
 * GET /api/reports/workflow-runs
 * Returns a detailed list of workflow executions.
 * Query Params:
 * - workflowId: Filter by specific workflow
 * - limit: Default 50
 * - status: Filter by success/failed
 */
router.get('/workflow-runs', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
        const { workflowId, status, limit = 50 } = req.query;
        let query = `
            SELECT 
                r.id, r.workflow_id, r.phone_number, r.status, 
                r.execution_log, r.context_preview, r.error_message, 
                r.started_at, r.ended_at, r.duration_ms,
                w.name as workflow_name
            FROM workflow_runs r
            JOIN workflows w ON r.workflow_id = w.id
        `;
        const params = [];

        const conditions = [];
        if (workflowId) {
            conditions.push(`r.workflow_id = $${params.length + 1}`);
            params.push(workflowId);
        }
        if (status) {
            conditions.push(`r.status = $${params.length + 1}`);
            params.push(status);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY r.started_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await db.query(query, params);
        res.json({ success: true, runs: result.rows });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/reports/workflow-runs/:id
 * Detailed trace of a single run including matched webhook data.
 */
router.get('/workflow-runs/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const runRes = await db.query(`
            SELECT r.*, w.name as workflow_name 
            FROM workflow_runs r
            JOIN workflows w ON r.workflow_id = w.id
            WHERE r.id = $1
        `, [id]);

        if (runRes.rowCount === 0) {
            return res.status(404).json({ error: 'Run not found' });
        }

        const run = runRes.rows[0];
        let webhookData = null;

        // Attempt to find original webhook payload if linked
        const webhookId = run.context_preview?.webhookEventId;
        if (webhookId) {
            const webRes = await db.query('SELECT * FROM webhook_events WHERE id = $1', [webhookId]);
            webhookData = webRes.rows[0] || null;
        }

        res.json({ success: true, run, webhookData });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
