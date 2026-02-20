'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');

router.get('/whatsapp/flows', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const result = await db.query(
      `
      SELECT id, flow_id, name, description, categories, flow_json, created_at, updated_at
      FROM whatsapp_flows
      ORDER BY created_at DESC
      `
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/whatsapp/flows', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { name, description, categories, flow_json, flow_id } = req.body || {};

    if (!name || !flow_json) {
      const err = new Error('name and flow_json are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const result = await db.query(
      `
      INSERT INTO whatsapp_flows (flow_id, name, description, categories, flow_json)
      VALUES ($1, $2, $3, COALESCE($4, ARRAY[]::text[]), $5::jsonb)
      RETURNING id, flow_id, name, description, categories, flow_json, created_at, updated_at
      `,
      [flow_id || null, name, description || null, categories || null, JSON.stringify(flow_json)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/whatsapp/flows/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, categories, flow_json, flow_id } = req.body || {};

    const result = await db.query(
      `
      UPDATE whatsapp_flows
      SET
        flow_id = COALESCE($1, flow_id),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        categories = COALESCE($4, categories),
        flow_json = COALESCE($5::jsonb, flow_json),
        updated_at = NOW()
      WHERE id = $6
      RETURNING id, flow_id, name, description, categories, flow_json, created_at, updated_at
      `,
      [
        typeof flow_id === 'undefined' ? null : flow_id,
        typeof name === 'undefined' ? null : name,
        typeof description === 'undefined' ? null : description,
        typeof categories === 'undefined' ? null : categories,
        typeof flow_json === 'undefined' ? null : JSON.stringify(flow_json),
        id,
      ]
    );

    if (result.rowCount === 0) {
      const err = new Error('Flow not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/whatsapp/flows/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM whatsapp_flows WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      const err = new Error('Flow not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

