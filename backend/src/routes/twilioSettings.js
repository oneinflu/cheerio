'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const db = require('../../db');
const twilio = require('../services/twilioClient');

async function resolveTeamId(req) {
    if (req.query?.teamId) return req.query.teamId;
    if (req.user && Array.isArray(req.user.teamIds) && req.user.teamIds.length > 0) {
        return req.user.teamIds[0];
    }
    if (req.user?.id) {
        try {
            const res = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [req.user.id]);
            const t = res.rows[0]?.team_id;
            if (t) return t;
        } catch (e) {}
    }
    return 'default';
}

// GET /api/settings/twilio
router.get('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const result = await db.query(
            `SELECT account_sid, auth_token, phone_number, messaging_service_sid, is_active FROM twilio_settings WHERE team_id = $1`,
            [teamId]
        );
        if (result.rowCount === 0) return res.json({ settings: null });
        const row = result.rows[0];
        res.json({ settings: { ...row, auth_token: row.auth_token ? '••••••••' : '' } });
    } catch (err) { next(err); }
});

// PUT /api/settings/twilio
router.put('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const { account_sid, auth_token, phone_number, messaging_service_sid, is_active } = req.body || {};

        if (!account_sid || !auth_token || !phone_number) {
            return res.status(400).json({ error: 'account_sid, auth_token, and phone_number are required' });
        }

        let tokenToSave = auth_token;
        if (auth_token === '••••••••') {
            const existing = await db.query('SELECT auth_token FROM twilio_settings WHERE team_id = $1', [teamId]);
            tokenToSave = existing.rows[0]?.auth_token || auth_token;
        }

        const result = await db.query(
            `INSERT INTO twilio_settings (team_id, account_sid, auth_token, phone_number, messaging_service_sid, is_active, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,NOW())
             ON CONFLICT (team_id) DO UPDATE SET
               account_sid = EXCLUDED.account_sid,
               auth_token = EXCLUDED.auth_token,
               phone_number = EXCLUDED.phone_number,
               messaging_service_sid = EXCLUDED.messaging_service_sid,
               is_active = EXCLUDED.is_active,
               updated_at = NOW()
             RETURNING account_sid, phone_number, messaging_service_sid, is_active`,
            [teamId, account_sid, tokenToSave, phone_number, messaging_service_sid || null, is_active === undefined ? true : is_active]
        );

        res.json({ settings: result.rows[0], success: true });
    } catch (err) { next(err); }
});

// DELETE /api/settings/twilio
router.delete('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        await db.query('DELETE FROM twilio_settings WHERE team_id = $1', [teamId]);
        res.json({ success: true, message: 'Twilio disconnected' });
    } catch (err) { next(err); }
});

// POST /api/settings/twilio/sms — send an SMS
router.post('/sms', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const { to, body, from, contact_id, conversation_id } = req.body || {};

        if (!to) return res.status(400).json({ error: '"to" is required' });
        if (!body) return res.status(400).json({ error: '"body" (message text) is required' });

        const creds = await twilio.getCredentials(teamId);
        if (!creds) return res.status(400).json({ error: 'Twilio is not connected. Please configure it in Settings.' });

        const result = await twilio.sendSms({ teamId, to, body, from });

        await twilio.saveLog({
            teamId,
            type: 'sms',
            sid: result.sid,
            fromNumber: result.from,
            toNumber: to,
            direction: 'outbound',
            status: result.status || 'sent',
            body,
            contactId: contact_id || null,
            conversationId: conversation_id || null,
            initiatedBy: req.user?.id || null
        });

        res.json({ success: true, message: result });
    } catch (err) {
        console.error('[TwilioRoute] sendSms error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to send SMS' });
    }
});

// POST /api/settings/twilio/call — initiate a call
router.post('/call', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const { to, from, record, contact_id, conversation_id } = req.body || {};

        if (!to) return res.status(400).json({ error: '"to" is required' });

        const creds = await twilio.getCredentials(teamId);
        if (!creds) return res.status(400).json({ error: 'Twilio is not connected. Please configure it in Settings.' });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const statusCallbackUrl = `${baseUrl}/webhooks/twilio/call`;

        const result = await twilio.initiateCall({ teamId, to, from, statusCallbackUrl, record: !!record });

        await twilio.saveLog({
            teamId,
            type: 'call',
            sid: result.sid,
            fromNumber: result.from,
            toNumber: to,
            direction: 'outbound',
            status: result.status || 'initiated',
            contactId: contact_id || null,
            conversationId: conversation_id || null,
            initiatedBy: req.user?.id || null
        });

        res.json({ success: true, call: result });
    } catch (err) {
        console.error('[TwilioRoute] initiateCall error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to initiate call' });
    }
});

// GET /api/settings/twilio/logs — fetch logs
router.get('/logs', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const type = req.query.type || null; // 'sms' | 'call' | null (all)
        const limit = parseInt(req.query.limit) || 25;
        const offset = parseInt(req.query.offset) || 0;
        const logs = await twilio.getLogs(teamId, { type, limit, offset });
        res.json({ logs });
    } catch (err) { next(err); }
});

module.exports = router;
