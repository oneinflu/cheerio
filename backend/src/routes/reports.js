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
router.get('/workflow-runs', auth.requireAuth, async (req, res, next) => {
    try {
        const { workflowId, status, limit = 50 } = req.query;
        let query = `
            SELECT 
                r.id, r.workflow_id, r.phone_number, r.status, 
                r.execution_log, r.context_preview, r.error_message, 
                r.started_at, r.ended_at, r.duration_ms,
                COALESCE(w.name, 'Deleted Workflow') as workflow_name
            FROM workflow_runs r
            LEFT JOIN workflows w ON r.workflow_id = w.id
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
 * GET /api/reports/templates
 * Track delivery status for all outbound template messages (sent via API, Campaign, or Workflow)
 */
router.get('/templates', auth.requireAuth, async (req, res, next) => {
    try {
        const { limit = 100, templateName } = req.query;
        let query = `
            SELECT 
                m.id, m.conversation_id, m.external_message_id, 
                m.text_body, m.delivery_status, m.created_at,
                m.sent_at, m.delivered_at, m.read_at,
                COALESCE(m.template_name, m.raw_payload->>'name') as template_name,
                c.display_name as contact_name,
                ch.external_id as contact_phone
            FROM messages m
            JOIN conversations con ON m.conversation_id = con.id
            JOIN contacts ch ON con.contact_id = ch.id
            LEFT JOIN contacts c ON con.contact_id = c.id
            WHERE m.direction = 'outbound' 
              AND (m.template_name IS NOT NULL OR m.content_type = 'template' OR m.raw_payload->>'type' = 'template' OR m.text_body LIKE 'Template: %')
        `;
        const params = [];

        if (templateName) {
            query += ` AND (m.template_name = $1 OR m.raw_payload->>'name' = $1 OR m.text_body = $1) `;
            params.push(templateName);
        }

        query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await db.query(query, params);
        res.json({ success: true, messages: result.rows });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/reports/workflow-runs/:id
 * Detailed trace of a single run including matched webhook data.
 */
router.get('/workflow-runs/:id', auth.requireAuth, async (req, res, next) => {
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
