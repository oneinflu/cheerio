'use strict';
const express = require('express');
const router = express.Router();
const whatsappClient = require('../integrations/meta/whatsappClient');
const db = require('../db');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

/**
 * GET /api/templates
 * List all templates for the configured WABA.
 */
router.get('/', async (req, res, next) => {
  if (!WABA_ID) {
    // Fallback/Demo mode if no WABA ID is set
    console.warn('[templates] WHATSAPP_BUSINESS_ACCOUNT_ID not set. Returning empty list.');
    return res.json({ data: [] });
  }
  try {
    console.log('[templates] Fetching templates for WABA:', WABA_ID);
    const resp = await whatsappClient.getTemplates(WABA_ID);
    const templates = resp.data && resp.data.data ? resp.data.data : [];

    // Fetch starred settings from DB
    const client = await db.getClient();
    let starredMap = new Set();
    try {
      const res = await client.query('SELECT template_name FROM template_settings WHERE is_starred = TRUE');
      res.rows.forEach(r => starredMap.add(r.template_name));
    } catch (dbErr) {
      console.error('Error fetching template settings:', dbErr);
    } finally {
      client.release();
    }

    // Merge info
    const enriched = templates.map(t => ({
      ...t,
      is_starred: starredMap.has(t.name)
    }));

    res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/templates/:name/star
 * Mark a template as starred.
 */
router.post('/:name/star', async (req, res, next) => {
  const { name } = req.params;
  const client = await db.getClient();
  try {
    await client.query(
      `INSERT INTO template_settings (template_name, is_starred, updated_at)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (template_name) 
       DO UPDATE SET is_starred = TRUE, updated_at = NOW()`,
      [name]
    );
    res.json({ success: true, name, is_starred: true });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/templates/:name/star
 * Unstar a template.
 */
router.delete('/:name/star', async (req, res, next) => {
  const { name } = req.params;
  const client = await db.getClient();
  try {
    await client.query(
      `INSERT INTO template_settings (template_name, is_starred, updated_at)
       VALUES ($1, FALSE, NOW())
       ON CONFLICT (template_name) 
       DO UPDATE SET is_starred = FALSE, updated_at = NOW()`,
      [name]
    );
    res.json({ success: true, name, is_starred: false });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/templates
 * Create a new message template.
 */
router.post('/', async (req, res, next) => {
  if (!WABA_ID) {
    const err = new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not configured');
    err.status = 500;
    err.expose = true;
    return next(err);
  }
  try {
    const resp = await whatsappClient.createTemplate(WABA_ID, req.body);
    res.json(resp.data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/templates/upload-example
 * Upload media for template example (returns handle).
 */
router.post('/upload-example', upload.single('file'), async (req, res, next) => {
  if (!WABA_ID) {
    const err = new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not configured');
    err.status = 500;
    return next(err);
  }
  if (!req.file) {
    const err = new Error('File is required');
    err.status = 400;
    return next(err);
  }
  
  try {
    const resp = await whatsappClient.uploadMessageTemplateMedia(
      WABA_ID, 
      req.file.buffer, 
      req.file.mimetype, 
      req.file.originalname
    );
    // resp should be { h: "..." }
    res.json(resp);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/templates/send-test
 * Send a test template message.
 */
router.post('/send-test', async (req, res, next) => {
  const { to, templateName, languageCode, components } = req.body;
  if (!to || !templateName) {
    const err = new Error('Missing "to" or "templateName"');
    err.status = 400;
    return next(err);
  }

  // If WABA ID is missing, we can't send via the standard flow easily,
  // but standard message sending usually relies on Phone Number ID, not WABA ID directly.
  // The 'sendTemplateMessage' function in whatsappClient should handle this.
  
  try {
    // We reuse the existing outbound logic or call the client directly
    // The user provided a curl command that uses the graph API directly.
    // Let's use the whatsappClient helper if available, or implement a direct call matching their request.
    
    // Using the client helper is cleaner:
    const resp = await whatsappClient.sendTemplateMessage(to, templateName, languageCode || 'en_US', components);
    res.json(resp.data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
