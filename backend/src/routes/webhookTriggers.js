'use strict';
/**
 * src/routes/webhookTriggers.js
 *
 * Two concerns handled here:
 *
 * PUBLIC  (no auth)  POST /webhooks/workflow/:workflowId
 *   - Any external service can POST JSON here.
 *   - Payload is stored in webhook_events.
 *   - Returns {received: true}.
 *
 * PRIVATE (auth)     GET  /api/workflow-webhooks/:workflowId/events
 *   - Returns the last 10 events for that workflow so the UI can show
 *     what a real hit looks like (field names, types, sample values).
 *
 * PRIVATE (auth)     DELETE /api/workflow-webhooks/:workflowId/events
 *   - Clear event history for a workflow.
 */

const express = require('express');
const db = require('../../db');
const auth = require('../middlewares/auth');
const workflows = require('../services/workflows');

// ─── Public router (mounted WITHOUT /api, no auth middleware) ────────────────
const publicRouter = express.Router();

/**
 * POST /webhooks/workflow/:workflowId
 * Called by any external system. No auth needed.
 * Accepts any JSON body, stores it, and triggers the workflow if it has an incoming_webhook node.
 */
publicRouter.post('/:workflowId', async (req, res) => {
    try {
        const { workflowId } = req.params;
        const payload = req.body || {};
        const headers = {};

        // Capture safe headers (skip auth ones)
        const safeHeaders = ['content-type', 'user-agent', 'x-forwarded-for', 'x-real-ip', 'host'];
        safeHeaders.forEach(h => {
            if (req.headers[h]) headers[h] = req.headers[h];
        });

        // Store event (ignore if workflow doesn't exist — don't error the caller)
        try {
            await db.query(
                `INSERT INTO webhook_events (workflow_id, payload, headers, source_ip)
         VALUES ($1, $2, $3, $4)`,
                [
                    workflowId,
                    JSON.stringify(payload),
                    JSON.stringify(headers),
                    req.ip || req.connection?.remoteAddress || null,
                ]
            );
        } catch (dbErr) {
            // Silently ignore — workflow might not exist, that's OK
            console.warn('[webhook] Could not store event:', dbErr.message);
        }

        try {
            const wf = await workflows.getWorkflow(workflowId);
            const steps = wf && wf.steps ? wf.steps : null;
            const nodes = steps && Array.isArray(steps.nodes) ? steps.nodes : [];
            const hasIncomingWebhookNode = nodes.some((n) => n && n.type === 'incoming_webhook');

            if (wf && hasIncomingWebhookNode) {
                const phoneRaw = payload.phone || payload.mobile || payload.whatsapp || payload.contact || '';
                const name = payload.name || payload.full_name || payload.username || '';
                const email = payload.email || payload.mail || '';

                const normalizedPhone = String(phoneRaw || '').replace(/[+\s-]/g, '');
                const context = { ...payload };
                if (name) context.name = name;
                if (email) context.email = email;
                if (normalizedPhone) context.phone = normalizedPhone;

                if (normalizedPhone) {
                    workflows
                        .runWorkflow(workflowId, normalizedPhone, context)
                        .catch((err) => {
                            console.error(`[webhook] Failed to run workflow ${workflowId}:`, err.message);
                        });
                } else {
                    console.warn(`[webhook] Skipping workflow ${workflowId}: no phone provided in payload`);
                }
            }
        } catch (runErr) {
            console.error('[webhook] Workflow trigger error:', runErr.message);
        }

        return res.json({ received: true, workflow_id: workflowId });
    } catch (err) {
        console.error('[webhook] Error:', err);
        return res.status(500).json({ received: false, error: err.message });
    }
});

// ─── Private router (mounted under /api, requires auth) ─────────────────────
const privateRouter = express.Router();

/**
 * GET /api/workflow-webhooks/:workflowId/events
 * Returns last 10 events for admin to see incoming payload shape.
 */
privateRouter.get(
    '/:workflowId/events',
    auth.requireRole('admin', 'supervisor'),
    async (req, res, next) => {
        try {
            const { workflowId } = req.params;
            const result = await db.query(
                `SELECT id, payload, headers, source_ip, received_at
         FROM webhook_events
         WHERE workflow_id = $1
         ORDER BY received_at DESC
         LIMIT 10`,
                [workflowId]
            );
            res.json({ success: true, events: result.rows });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * DELETE /api/workflow-webhooks/:workflowId/events
 * Clear event history.
 */
privateRouter.delete(
    '/:workflowId/events',
    auth.requireRole('admin', 'supervisor'),
    async (req, res, next) => {
        try {
            const { workflowId } = req.params;
            await db.query('DELETE FROM webhook_events WHERE workflow_id = $1', [workflowId]);
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }
);

module.exports = { publicRouter, privateRouter };
