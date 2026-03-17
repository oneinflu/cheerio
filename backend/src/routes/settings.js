'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const db = require('../../db');

async function resolveTeamId(req) {
  // Try query/body/user-derived hints, but do not rely on custom headers
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
  // Fallback: ensure a default team exists
  try {
    const anyTeam = await db.query('SELECT id FROM teams ORDER BY created_at ASC LIMIT 1');
    let t = anyTeam.rows[0]?.id;
    if (!t) {
      t = 'default';
      await db.query('INSERT INTO teams (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [t, 'Default Team']);
    }
    return t;
  } catch (e) {
    // Last resort default
    return 'default';
  }
}

async function handleGetLeadStages(req, res, next) {
  try {
    const teamId = await resolveTeamId(req);
    let result = await db.query(
      `
      SELECT id, name, color, position, is_closed
      FROM lead_stages
      WHERE team_id = $1
      ORDER BY position ASC, created_at ASC
      `,
      [teamId]
    );
    if (result.rowCount === 0) {
      const defaults = [
        { name: 'New', color: '#0ea5e9', position: 1, is_closed: false },
        { name: 'Contacted', color: '#6366f1', position: 2, is_closed: false },
        { name: 'Qualified', color: '#22c55e', position: 3, is_closed: false },
        { name: 'Enrolled', color: '#16a34a', position: 4, is_closed: true },
        { name: 'Lost', color: '#ef4444', position: 5, is_closed: true },
      ];
      await db.query(
        `
        INSERT INTO lead_stages (team_id, name, color, position, is_closed)
        SELECT $1, x.name, x.color, x.position, x.is_closed
        FROM jsonb_to_recordset($2::jsonb) AS x(name text, color text, position int, is_closed boolean)
        `,
        [teamId, JSON.stringify(defaults)]
      );
      result = await db.query(
        `
        SELECT id, name, color, position, is_closed
        FROM lead_stages
        WHERE team_id = $1
        ORDER BY position ASC, created_at ASC
        `,
        [teamId]
      );
    }
    res.json({ teamId, stages: result.rows });
  } catch (err) {
    next(err);
  }
}

async function handleCreateLeadStage(req, res, next) {
  try {
    const teamId = await resolveTeamId(req);
    const { name, color, is_closed } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    const posRes = await db.query(
      `SELECT COALESCE(MAX(position), 0) AS max_pos FROM lead_stages WHERE team_id = $1`,
      [teamId]
    );
    const nextPos = Number(posRes.rows[0].max_pos || 0) + 1;
    const result = await db.query(
      `
      INSERT INTO lead_stages (team_id, name, color, position, is_closed)
      VALUES ($1, $2, $3, $4, COALESCE($5, FALSE))
      RETURNING id, name, color, position, is_closed
      `,
      [teamId, name, color || null, nextPos, is_closed]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function handleUpdateLeadStage(req, res, next) {
  try {
    const { id } = req.params;
    const teamId = await resolveTeamId(req);
    const fields = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      fields.push('name');
      values.push(req.body.name);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'color')) {
      fields.push('color');
      values.push(req.body.color);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'position')) {
      fields.push('position');
      values.push(req.body.position);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'is_closed')) {
      fields.push('is_closed');
      values.push(req.body.is_closed);
    }

    if (!fields.length) {
      const existing = await db.query(
        `SELECT id, name, color, position, is_closed FROM lead_stages WHERE id = $1 AND team_id = $2`,
        [id, teamId]
      );
      if (existing.rowCount === 0) {
        return res.status(404).json({ error: 'Lead stage not found' });
      }
      return res.json(existing.rows[0]);
    }

    const setClause = fields
      .map((field, idx) => `${field} = $${idx + 1}`)
      .join(', ');

    const result = await db.query(
      `
      UPDATE lead_stages
      SET ${setClause}
      WHERE id = $${fields.length + 1} AND team_id = $${fields.length + 2}
      RETURNING id, name, color, position, is_closed
      `,
      [...values, id, teamId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lead stage not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function handleDeleteLeadStage(req, res, next) {
  try {
    const { id } = req.params;
    const teamId = await resolveTeamId(req);
    const result = await db.query(
      `DELETE FROM lead_stages WHERE id = $1 AND team_id = $2`,
      [id, teamId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lead stage not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function handleGetWorkingHours(req, res, next) {
  try {
    const teamId = await resolveTeamId(req);
    const result = await db.query(
      `
      SELECT timezone, hours
      FROM team_working_hours
      WHERE team_id = $1
      `,
      [teamId]
    );

    if (result.rowCount === 0) {
      const defaultHours = {
        mon: { closed: false, open: '09:00', close: '18:00' },
        tue: { closed: false, open: '09:00', close: '18:00' },
        wed: { closed: false, open: '09:00', close: '18:00' },
        thu: { closed: false, open: '09:00', close: '18:00' },
        fri: { closed: false, open: '09:00', close: '18:00' },
        sat: { closed: true, open: '09:00', close: '18:00' },
        sun: { closed: true, open: '09:00', close: '18:00' },
      };
      return res.json({
        teamId,
        timezone: 'Asia/Kolkata',
        hours: defaultHours,
      });
    }

    const row = result.rows[0];
    res.json({
      teamId,
      timezone: row.timezone,
      hours: row.hours || {},
    });
  } catch (err) {
    next(err);
  }
}

async function handleSaveWorkingHours(req, res, next) {
  try {
    const teamId = await resolveTeamId(req);
    const { timezone, hours } = req.body || {};
    if (!timezone || typeof timezone !== 'string') {
      return res.status(400).json({ error: 'timezone is required' });
    }
    if (!hours || typeof hours !== 'object') {
      return res.status(400).json({ error: 'hours is required' });
    }

    const existing = await db.query(
      `SELECT id FROM team_working_hours WHERE team_id = $1`,
      [teamId]
    );

    if (existing.rowCount === 0) {
      const result = await db.query(
        `
        INSERT INTO team_working_hours (team_id, timezone, hours)
        VALUES ($1, $2, $3::jsonb)
        RETURNING timezone, hours
        `,
        [teamId, timezone, JSON.stringify(hours)]
      );
      const row = result.rows[0];
      return res.json({
        teamId,
        timezone: row.timezone,
        hours: row.hours || {},
      });
    }

    const result = await db.query(
      `
      UPDATE team_working_hours
      SET timezone = $1,
          hours = $2::jsonb
      WHERE team_id = $3
      RETURNING timezone, hours
      `,
      [timezone, JSON.stringify(hours), teamId]
    );
    const row = result.rows[0];
    res.json({
      teamId,
      timezone: row.timezone,
      hours: row.hours || {},
    });
  } catch (err) {
    next(err);
  }
}

router.get('/lead-stages', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), handleGetLeadStages);
router.post('/lead-stages', auth.requireRole('admin', 'supervisor'), handleCreateLeadStage);
router.put('/lead-stages/:id', auth.requireRole('admin', 'supervisor'), handleUpdateLeadStage);
router.delete('/lead-stages/:id', auth.requireRole('admin', 'supervisor'), handleDeleteLeadStage);
router.get('/working-hours', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), handleGetWorkingHours);
router.put('/working-hours', auth.requireRole('admin', 'supervisor'), handleSaveWorkingHours);

router.get('/settings/lead-stages', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), handleGetLeadStages);
router.post('/settings/lead-stages', auth.requireRole('admin', 'supervisor'), handleCreateLeadStage);
router.put('/settings/lead-stages/:id', auth.requireRole('admin', 'supervisor'), handleUpdateLeadStage);
router.delete('/settings/lead-stages/:id', auth.requireRole('admin', 'supervisor'), handleDeleteLeadStage);
router.get('/settings/working-hours', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), handleGetWorkingHours);
router.put('/settings/working-hours', auth.requireRole('admin', 'supervisor'), handleSaveWorkingHours);

// WhatsApp settings
router.get('/whatsapp', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const result = await db.query(
      `SELECT phone_number_id, business_account_id, permanent_token, display_phone_number, is_active
       FROM whatsapp_settings WHERE team_id = $1`,
      [teamId]
    );
    if (result.rowCount === 0) {
      return res.json({
        teamId,
        settings: null,
        allSettings: []
      });
    }
    res.json({ 
      teamId, 
      settings: result.rows[0], 
      allSettings: result.rows 
    });
  } catch (err) {
    next(err);
  }
});

router.put('/whatsapp', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const { phone_number_id, business_account_id, permanent_token, display_phone_number, is_active } = req.body || {};
    
    // Upsert
    const result = await db.query(
      `INSERT INTO whatsapp_settings (team_id, phone_number_id, business_account_id, permanent_token, display_phone_number, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (team_id, phone_number_id) DO UPDATE SET
         business_account_id = EXCLUDED.business_account_id,
         permanent_token = EXCLUDED.permanent_token,
         display_phone_number = EXCLUDED.display_phone_number,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()
       RETURNING *`,
      [teamId, phone_number_id, business_account_id, permanent_token, display_phone_number, is_active === undefined ? true : is_active]
    );

    // If we have a token and WABA ID, ensure we are subscribed to webhooks
    if (permanent_token && business_account_id) {
      try {
        const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
        const axios = require('axios');
        console.log(`[Settings] Ensuring subscription for WABA: ${business_account_id}`);
        await axios.post(`${GRAPH_BASE}/${business_account_id}/subscribed_apps`, null, {
          params: { access_token: permanent_token }
        });
      } catch (subErr) {
        console.warn(`[Settings] Webhook subscription failed for WABA ${business_account_id}:`, subErr.message);
      }
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/whatsapp/:phone_number_id', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const { phone_number_id } = req.params;

    const result = await db.query(
      `DELETE FROM whatsapp_settings WHERE team_id = $1 AND phone_number_id = $2`,
      [teamId, phone_number_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'WhatsApp setting not found' });
    }

    res.json({ success: true, message: 'WhatsApp number disconnected' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
