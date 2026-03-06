'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');

router.get('/', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
  try {
    const result = await db.query(
      `
        SELECT id, name, subject, variables, design, created_at, updated_at
        FROM email_templates
        ORDER BY name ASC
      `
    );
    res.json({ success: true, templates: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { name, subject = '', html_body = '', text_body = '', variables = [], design = {} } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const varsJson = Array.isArray(variables) ? JSON.stringify(variables) : JSON.stringify([]);
    const designJson = JSON.stringify(design || {});
    const result = await db.query(
      `
        INSERT INTO email_templates (name, subject, html_body, text_body, variables, design, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW(), NOW())
        RETURNING id, name, subject, variables, design, created_at, updated_at
      `,
      [String(name).trim(), String(subject || ''), String(html_body || ''), String(text_body || ''), varsJson, designJson]
    );
    res.json({ success: true, template: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Template name already exists' });
    next(err);
  }
});

router.put('/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, subject, html_body, text_body, variables, design } = req.body || {};
    const varsJson = Array.isArray(variables) ? JSON.stringify(variables) : null;
    const designJson = design != null ? JSON.stringify(design) : null;
    const result = await db.query(
      `
        UPDATE email_templates
        SET
          name = COALESCE($2, name),
          subject = COALESCE($3, subject),
          html_body = COALESCE($4, html_body),
          text_body = COALESCE($5, text_body),
          variables = COALESCE($6::jsonb, variables),
          design = COALESCE($7::jsonb, design),
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, subject, variables, design, created_at, updated_at
      `,
      [
        id,
        name != null ? String(name).trim() : null,
        subject != null ? String(subject) : null,
        html_body != null ? String(html_body) : null,
        text_body != null ? String(text_body) : null,
        varsJson,
        designJson,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true, template: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM email_templates WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true, deleted_id: id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
