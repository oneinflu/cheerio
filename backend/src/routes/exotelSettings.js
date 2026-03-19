'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const db = require('../../db');
const exotel = require('../services/exotelClient');

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

// GET /api/settings/exotel
router.get('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const result = await db.query(
            `SELECT sid, api_key, api_token, subdomain, caller_id, is_active FROM exotel_settings WHERE team_id = $1`,
            [teamId]
        );
        if (result.rowCount === 0) return res.json({ settings: null });
        // Mask the api_token for security
        const row = result.rows[0];
        res.json({ settings: { ...row, api_token: row.api_token ? '••••••••' : '' } });
    } catch (err) { next(err); }
});

// PUT /api/settings/exotel
router.put('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const { sid, api_key, api_token, subdomain, caller_id, is_active } = req.body || {};

        if (!sid || !api_key || !api_token || !subdomain) {
            return res.status(400).json({ error: 'sid, api_key, api_token, and subdomain are required' });
        }

        // If api_token is masked (unchanged), fetch existing token
        let tokenToSave = api_token;
        if (api_token === '••••••••') {
            const existing = await db.query('SELECT api_token FROM exotel_settings WHERE team_id = $1', [teamId]);
            tokenToSave = existing.rows[0]?.api_token || api_token;
        }

        const result = await db.query(
            `INSERT INTO exotel_settings (team_id, sid, api_key, api_token, subdomain, caller_id, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (team_id) DO UPDATE SET
               sid = EXCLUDED.sid,
               api_key = EXCLUDED.api_key,
               api_token = EXCLUDED.api_token,
               subdomain = EXCLUDED.subdomain,
               caller_id = EXCLUDED.caller_id,
               is_active = EXCLUDED.is_active,
               updated_at = NOW()
             RETURNING sid, api_key, subdomain, caller_id, is_active`,
            [teamId, sid, api_key, tokenToSave, subdomain, caller_id || null, is_active === undefined ? true : is_active]
        );

        res.json({ settings: result.rows[0], success: true });
    } catch (err) { next(err); }
});

// DELETE /api/settings/exotel
router.delete('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        await db.query('DELETE FROM exotel_settings WHERE team_id = $1', [teamId]);
        res.json({ success: true, message: 'Exotel disconnected' });
    } catch (err) { next(err); }
});

// POST /api/settings/exotel/call — initiate a click-to-call
router.post('/call', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const { from, to, caller_id, record, contact_id, conversation_id } = req.body || {};

        if (!to) return res.status(400).json({ error: '"to" (customer phone) is required' });

        const creds = await exotel.getCredentials(teamId);
        if (!creds) return res.status(400).json({ error: 'Exotel is not connected. Please configure it in Settings.' });

        const effectiveFrom = from || creds.caller_id;
        if (!effectiveFrom) return res.status(400).json({ error: 'No "from" number or caller_id configured' });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const statusCallbackUrl = `${baseUrl}/webhooks/exotel/status`;

        const callResult = await exotel.initiateCall({
            teamId,
            from: effectiveFrom,
            to,
            callerId: caller_id || creds.caller_id,
            statusCallbackUrl,
            record: !!record
        });

        // Save log
        await exotel.saveCallLog({
            teamId,
            callSid: callResult.callSid,
            fromNumber: effectiveFrom,
            toNumber: to,
            direction: 'outbound',
            status: callResult.status || 'initiated',
            contactId: contact_id || null,
            conversationId: conversation_id || null,
            initiatedBy: req.user?.id || null
        });

        res.json({ success: true, call: callResult });
    } catch (err) {
        console.error('[ExotelRoute] initiateCall error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to initiate call' });
    }
});

// GET /api/settings/exotel/calls — fetch call logs
router.get('/calls', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const limit = parseInt(req.query.limit) || 25;
        const offset = parseInt(req.query.offset) || 0;
        const logs = await exotel.getCallLogs(teamId, { limit, offset });
        res.json({ calls: logs });
    } catch (err) { next(err); }
});

module.exports = router;
