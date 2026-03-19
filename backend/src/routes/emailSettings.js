'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const db = require('../../db');
const email = require('../services/emailClient');

async function resolveTeamId(req) {
    if (req.query?.teamId) return req.query.teamId;
    if (req.user && Array.isArray(req.user.teamIds) && req.user.teamIds.length > 0) return req.user.teamIds[0];
    if (req.user?.id) {
        try {
            const r = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [req.user.id]);
            if (r.rows[0]?.team_id) return r.rows[0].team_id;
        } catch {}
    }
    return 'default';
}

const MASKED = '••••••••';

// GET /api/settings/email
router.get('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const r = await db.query(`SELECT * FROM email_settings WHERE team_id = $1`, [teamId]);
        if (r.rowCount === 0) return res.json({ settings: null });
        const row = r.rows[0];
        res.json({ settings: { ...row, smtp_pass: MASKED, imap_pass: row.imap_pass ? MASKED : '' } });
    } catch (err) { next(err); }
});

// PUT /api/settings/email
router.put('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const { display_name, email_address, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
                imap_host, imap_port, imap_secure, imap_user, imap_pass, is_active } = req.body || {};

        if (!email_address || !smtp_host || !smtp_user || !smtp_pass || !imap_host) {
            return res.status(400).json({ error: 'email_address, smtp_host, smtp_user, smtp_pass, and imap_host are required' });
        }

        // Preserve masked passwords
        let smtpPassToSave = smtp_pass;
        let imapPassToSave = imap_pass;
        if (smtp_pass === MASKED || imap_pass === MASKED) {
            const existing = await db.query('SELECT smtp_pass, imap_pass FROM email_settings WHERE team_id = $1', [teamId]);
            if (smtp_pass === MASKED) smtpPassToSave = existing.rows[0]?.smtp_pass || smtp_pass;
            if (imap_pass === MASKED) imapPassToSave = existing.rows[0]?.imap_pass || imap_pass;
        }

        const r = await db.query(
            `INSERT INTO email_settings
             (team_id, display_name, email_address, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
              imap_host, imap_port, imap_secure, imap_user, imap_pass, is_active, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
             ON CONFLICT (team_id) DO UPDATE SET
               display_name=EXCLUDED.display_name, email_address=EXCLUDED.email_address,
               smtp_host=EXCLUDED.smtp_host, smtp_port=EXCLUDED.smtp_port, smtp_secure=EXCLUDED.smtp_secure,
               smtp_user=EXCLUDED.smtp_user, smtp_pass=EXCLUDED.smtp_pass,
               imap_host=EXCLUDED.imap_host, imap_port=EXCLUDED.imap_port, imap_secure=EXCLUDED.imap_secure,
               imap_user=EXCLUDED.imap_user, imap_pass=EXCLUDED.imap_pass,
               is_active=EXCLUDED.is_active, updated_at=NOW()
             RETURNING id, email_address, display_name, smtp_host, imap_host, is_active, last_synced_at`,
            [teamId, display_name || null, email_address, smtp_host, smtp_port || 587, !!smtp_secure,
             smtp_user, smtpPassToSave, imap_host, imap_port || 993, imap_secure !== false,
             imap_user || smtp_user, imapPassToSave || smtpPassToSave, is_active === undefined ? true : is_active]
        );
        res.json({ settings: r.rows[0], success: true });
    } catch (err) { next(err); }
});

// POST /api/settings/email/test
router.post('/test', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const creds = await email.getCredentials(teamId);
        if (!creds) return res.status(400).json({ error: 'Email not configured' });
        await email.testConnection(creds);
        res.json({ success: true, message: 'SMTP and IMAP connections verified successfully.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// DELETE /api/settings/email
router.delete('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        await db.query('DELETE FROM email_settings WHERE team_id = $1', [teamId]);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// POST /api/settings/email/send
router.post('/send', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const { to, subject, bodyText, bodyHtml, cc, inReplyTo } = req.body || {};
        if (!to || !subject) return res.status(400).json({ error: '"to" and "subject" are required' });
        const result = await email.sendEmail({ teamId, to, subject, bodyText, bodyHtml, cc, inReplyTo, sentBy: req.user?.id });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/settings/email/sync  — pull latest from IMAP
router.post('/sync', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const fetched = await email.fetchEmails(teamId, { limit: req.body?.limit || 30 });
        res.json({ success: true, fetched: fetched.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/settings/email/messages
router.get('/messages', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        const { direction, threadId, search, limit = 30, offset = 0 } = req.query;
        const messages = await email.getMessages(teamId, {
            direction: direction || undefined,
            threadId: threadId || undefined,
            search: search || undefined,
            limit: parseInt(limit), offset: parseInt(offset)
        });
        res.json({ messages });
    } catch (err) { next(err); }
});

// PATCH /api/settings/email/messages/:id/read
router.patch('/messages/:id/read', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        await email.markAsRead(req.params.id, teamId);
        res.json({ success: true });
    } catch (err) { next(err); }
});

// DELETE /api/settings/email/messages/:id
router.delete('/messages/:id', auth.requireRole('admin', 'super_admin', 'agent'), async (req, res, next) => {
    try {
        const teamId = await resolveTeamId(req);
        await email.deleteMessage(req.params.id, teamId);
        res.json({ success: true });
    } catch (err) { next(err); }
});

module.exports = router;
