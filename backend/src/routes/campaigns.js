'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');
const whatsappClient = require('../integrations/meta/whatsappClient');

/**
 * GET /api/campaigns
 * List all campaigns with label name and contact count.
 */
router.get('/', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT 
                c.id, c.name, c.channel_type, c.status,
                c.template_name, c.scheduled_at, c.started_at, c.completed_at,
                c.total_contacts, c.sent_count, c.delivered_count,
                c.created_at, c.variable_mapping,
                cl.id as label_id, cl.name as label_name
            FROM campaigns c
            LEFT JOIN contact_labels cl ON cl.id = c.label_id
            ORDER BY c.created_at DESC
        `);
        res.json({ success: true, campaigns: result.rows });
    } catch (err) { next(err); }
});

/**
 * POST /api/campaigns
 * Create a new campaign (draft or scheduled).
 */
router.post('/', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const {
            name, channel_type = 'whatsapp',
            label_id, template_name, template_language = 'en_US',
            template_components = [], variable_mapping = {},
            scheduled_at,   // ISO string or null (null = send now)
            send_immediately = false,
        } = req.body;

        if (!name?.trim()) return res.status(400).json({ error: 'Campaign name is required' });
        if (!label_id) return res.status(400).json({ error: 'Contact group (label) is required' });
        if (!template_name && channel_type === 'whatsapp')
            return res.status(400).json({ error: 'Template is required for WhatsApp campaigns' });

        // Count contacts in the label
        const countRes = await db.query(
            'SELECT COUNT(*)::int as total FROM contact_label_maps WHERE label_id = $1',
            [label_id]
        );
        const total_contacts = countRes.rows[0].total;

        const status = send_immediately ? 'running' : (scheduled_at ? 'scheduled' : 'draft');
        const started_at = send_immediately ? new Date().toISOString() : null;

        const result = await db.query(`
            INSERT INTO campaigns 
              (name, channel_type, label_id, template_name, template_language, template_components,
               variable_mapping, status, scheduled_at, started_at, total_contacts)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING *
        `, [
            name.trim(), channel_type, label_id, template_name, template_language,
            JSON.stringify(template_components), JSON.stringify(variable_mapping),
            status, scheduled_at || null, started_at, total_contacts
        ]);

        const campaign = result.rows[0];

        // If send_immediately, fire off messages in the background
        if (send_immediately && channel_type === 'whatsapp') {
            sendCampaignMessages(campaign).catch(err =>
                console.error(`[campaign] Error sending campaign ${campaign.id}:`, err));
        }

        res.json({ success: true, campaign });
    } catch (err) { next(err); }
});

/**
 * POST /api/campaigns/:id/stop
 * Stop a running campaign.
 */
router.post('/:id/stop', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const { id } = req.params;
        await db.query(
            "UPDATE campaigns SET status = 'stopped', updated_at = NOW() WHERE id = $1",
            [id]
        );
        res.json({ success: true });
    } catch (err) { next(err); }
});

/**
 * DELETE /api/campaigns/:id
 */
router.delete('/:id', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM campaigns WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// ─── Background campaign sender ───────────────────────────────────────────────
async function sendCampaignMessages(campaign) {
    try {
        // Get contacts from label
        const contactsRes = await db.query(`
            SELECT c.id, c.external_id, c.display_name, c.profile,
                   ch.config as channel_config
            FROM contact_label_maps clm
            JOIN contacts c ON c.id = clm.contact_id
            JOIN channels ch ON ch.id = c.channel_id
            WHERE clm.label_id = $1
        `, [campaign.label_id]);

        const contacts = contactsRes.rows;
        const mapping = campaign.variable_mapping || {};

        let sent = 0;
        for (const contact of contacts) {
            // Check if campaign was stopped
            const check = await db.query('SELECT status FROM campaigns WHERE id = $1', [campaign.id]);
            if (check.rows[0]?.status === 'stopped') break;

            try {
                // Build variable parameters from mapping
                const parameters = Object.keys(mapping).sort().map(varNum => {
                    const field = mapping[varNum];
                    let value = '';
                    if (field === 'display_name') value = contact.display_name || '';
                    else if (field === 'external_id') value = contact.external_id || '';
                    else if (contact.profile && contact.profile[field]) value = contact.profile[field];
                    return { type: 'text', text: value || '-' };
                });

                const components = parameters.length > 0
                    ? [{ type: 'body', parameters }]
                    : campaign.template_components;

                const resp = await whatsappClient.sendTemplateMessage(
                    contact.external_id,
                    campaign.template_name,
                    campaign.template_language || 'en_US',
                    components
                );

                await db.query(
                    `INSERT INTO campaign_logs (campaign_id, contact_id, status, wa_message_id, sent_at)
                     VALUES ($1, $2, 'sent', $3, NOW())`,
                    [campaign.id, contact.id, resp?.data?.messages?.[0]?.id || null]
                );
                sent++;
            } catch (sendErr) {
                console.error(`[campaign] Failed to send to ${contact.external_id}:`, sendErr.message);
                await db.query(
                    `INSERT INTO campaign_logs (campaign_id, contact_id, status, error_message)
                     VALUES ($1, $2, 'failed', $3)`,
                    [campaign.id, contact.id, sendErr.message]
                );
            }

            // Small delay to avoid Meta rate limits
            await new Promise(r => setTimeout(r, 100));
        }

        await db.query(
            `UPDATE campaigns SET status = 'completed', completed_at = NOW(), sent_count = $2, updated_at = NOW() WHERE id = $1`,
            [campaign.id, sent]
        );
    } catch (err) {
        console.error(`[campaign] Fatal error for campaign ${campaign.id}:`, err);
        await db.query("UPDATE campaigns SET status = 'stopped', updated_at = NOW() WHERE id = $1", [campaign.id]);
    }
}

module.exports = router;
