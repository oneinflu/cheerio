'use strict';
/**
 * src/routes/instagramAutomation.js
 *
 * Purpose:
 * - CRUD for Instagram automation rules: auto-DM, comment-to-DM, auto-reply.
 * - Rules are stored in the instagram_automations table.
 * - The webhook handler checks these rules when processing events.
 */

const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const db = require('../../db');

/**
 * GET /api/instagram/automations
 * Fetch all automation rules for the team's Instagram channels.
 */
router.get('/', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.*, c.name AS channel_name 
       FROM instagram_automations a
       LEFT JOIN channels c ON c.id = a.channel_id
       ORDER BY a.created_at DESC`
    );
    res.json({ automations: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/instagram/automations
 * Create a new automation rule.
 * 
 * Body: {
 *   channel_id: UUID,
 *   type: 'auto_reply' | 'comment_dm' | 'auto_dm',
 *   name: string,
 *   trigger: { keyword?: string, comment_keyword?: string, post_id?: string },
 *   action: { message: string, delay_seconds?: number },
 *   is_active: boolean
 * }
 */
router.post('/', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { channel_id, type, name, trigger, action, is_active } = req.body || {};

    if (!channel_id || !type || !name || !action?.message) {
      const err = new Error('channel_id, type, name, and action.message are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    if (!['auto_reply', 'comment_dm', 'auto_dm'].includes(type)) {
      const err = new Error('type must be auto_reply, comment_dm, or auto_dm');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const result = await db.query(
      `INSERT INTO instagram_automations (id, channel_id, type, name, trigger_config, action_config, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::jsonb, $6, NOW(), NOW())
       RETURNING *`,
      [channel_id, type, name, JSON.stringify(trigger || {}), JSON.stringify(action), is_active !== false]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/instagram/automations/:id
 * Update an existing automation rule.
 */
router.put('/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, trigger, action, is_active } = req.body || {};

    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (trigger !== undefined) { updates.push(`trigger_config = $${idx++}::jsonb`); values.push(JSON.stringify(trigger)); }
    if (action !== undefined) { updates.push(`action_config = $${idx++}::jsonb`); values.push(JSON.stringify(action)); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
      `UPDATE instagram_automations SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/instagram/automations/:id
 */
router.delete('/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM instagram_automations WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/instagram/automations/:id/toggle
 * Quick toggle active/inactive
 */
router.post('/:id/toggle', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE instagram_automations SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
