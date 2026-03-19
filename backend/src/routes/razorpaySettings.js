'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const db = require('../../db');

async function resolveTeamId(req) {
  if (req.query && req.query.teamId) return req.query.teamId;
  if (req.user && Array.isArray(req.user.teamIds) && req.user.teamIds.length > 0) {
    return req.user.teamIds[0];
  }
  if (req.user && req.user.id) {
    try {
      const res = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [req.user.id]);
      const t = res.rows[0]?.team_id;
      if (t) return t;
    } catch (e) {}
  }
  return 'default';
}

// GET /api/settings/razorpay
router.get('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const result = await db.query(
      `SELECT key_id, key_secret, webhook_secret, is_active FROM razorpay_settings WHERE team_id = $1`,
      [teamId]
    );

    if (result.rowCount === 0) {
      return res.json({ settings: null });
    }

    res.json({ settings: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/razorpay
router.put('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const { key_id, key_secret, webhook_secret, is_active } = req.body || {};

    if (!key_id || !key_secret) {
      return res.status(400).json({ error: 'key_id and key_secret are required' });
    }

    const result = await db.query(
      `INSERT INTO razorpay_settings (team_id, key_id, key_secret, webhook_secret, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (team_id) DO UPDATE SET
         key_id = EXCLUDED.key_id,
         key_secret = EXCLUDED.key_secret,
         webhook_secret = EXCLUDED.webhook_secret,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()
       RETURNING key_id, key_secret, webhook_secret, is_active`,
      [teamId, key_id, key_secret, webhook_secret, is_active === undefined ? true : is_active]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/razorpay
router.delete('/', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    await db.query(`DELETE FROM razorpay_settings WHERE team_id = $1`, [teamId]);
    res.json({ success: true, message: 'Razorpay disconnected' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
