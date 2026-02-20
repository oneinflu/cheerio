'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const db = require('../../db');

function resolveTeamId(req) {
  if (req.query && req.query.teamId) return req.query.teamId;
  if (req.user && Array.isArray(req.user.teamIds) && req.user.teamIds.length > 0) {
    return req.user.teamIds[0];
  }
  return null;
}

router.get('/settings/lead-stages', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const teamId = resolveTeamId(req);
    if (!teamId) {
      return res.status(400).json({ error: 'teamId required' });
    }
    const result = await db.query(
      `
      SELECT id, name, color, position, is_closed
      FROM lead_stages
      WHERE team_id = $1
      ORDER BY position ASC, created_at ASC
      `,
      [teamId]
    );
    res.json({ teamId, stages: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/settings/lead-stages', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const teamId = resolveTeamId(req);
    if (!teamId) {
      return res.status(400).json({ error: 'teamId required' });
    }
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
});

router.put('/settings/lead-stages/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const teamId = resolveTeamId(req);
    if (!teamId) {
      return res.status(400).json({ error: 'teamId required' });
    }
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
});

router.delete('/settings/lead-stages/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const teamId = resolveTeamId(req);
    if (!teamId) {
      return res.status(400).json({ error: 'teamId required' });
    }
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
});

router.get('/settings/working-hours', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const teamId = resolveTeamId(req);
    if (!teamId) {
      return res.status(400).json({ error: 'teamId required' });
    }
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
});

router.put('/settings/working-hours', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const teamId = resolveTeamId(req);
    if (!teamId) {
      return res.status(400).json({ error: 'teamId required' });
    }
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
});

module.exports = router;

