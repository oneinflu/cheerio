'use strict';
const express = require('express');
const router = express.Router();
const whatsappClient = require('../integrations/meta/whatsappClient');
const db = require('../../db');
const auth = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const cloudinaryLib = require('cloudinary').v2;

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const HAS_CLOUDINARY =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (HAS_CLOUDINARY) {
  cloudinaryLib.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

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
      console.log(`[templates] Found ${starredMap.size} starred templates in DB.`);
    } catch (dbErr) {
      console.error('[templates] Error fetching template settings (migration might be missing):', dbErr.message);
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
    const e = new Error(err.message || 'Template creation failed');
    e.status = err.status || 500;
    e.expose = true;
    return next(e);
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
    err.expose = true;
    return next(err);
  }
  if (!req.file) {
    const err = new Error('File is required');
    err.status = 400;
    err.expose = true;
    return next(err);
  }
  
  try {
    const resp = await whatsappClient.uploadMessageTemplateMedia(
      WABA_ID, 
      req.file.buffer, 
      req.file.mimetype, 
      req.file.originalname
    );
    res.json(resp);
  } catch (err) {
    const e = new Error(err.message || 'Template media upload failed');
    e.status = err.status || 500;
    e.expose = true;
    return next(e);
  }
});

/**
 * POST /api/templates/upload-test-media
 * Upload media for test template sending (returns URL or ID).
 *
 * This uses Cloudinary (if configured) and returns a payload similar to
 * the /api/whatsapp/upload endpoint: { id, url, kind, mime_type, original_filename }.
 */
router.post('/upload-test-media', auth.requireRole('admin','agent','supervisor'), upload.single('file'), async (req, res, next) => {
  try {
    if (!HAS_CLOUDINARY) {
      const err = new Error('Cloudinary is not configured for media uploads');
      err.status = 500;
      err.expose = true;
      throw err;
    }
    if (!req.file) {
      const err = new Error('File is required');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const base64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${base64}`;

    let cloudResult;
    try {
      cloudResult = await cloudinaryLib.uploader.upload(dataUri, {
        resource_type: 'auto',
        folder: process.env.CLOUDINARY_FOLDER || 'whatsapp_media',
        use_filename: true,
        unique_filename: true,
      });
    } catch (cloudErr) {
      const err = new Error(`[upload-test-media] Cloudinary upload failed: ${cloudErr.message}`);
      err.status = 500;
      err.expose = true;
      throw err;
    }

    if (!cloudResult || !cloudResult.secure_url) {
      const err = new Error('Cloudinary upload did not return a secure_url');
      err.status = 500;
      err.expose = true;
      throw err;
    }

    const mimeType = req.file.mimetype || null;
    const kind =
      mimeType && mimeType.startsWith('image/')
        ? 'image'
        : mimeType && mimeType.startsWith('video/')
        ? 'video'
        : mimeType && mimeType.startsWith('audio/')
        ? 'audio'
        : 'document';

    res.status(200).json({
      id: cloudResult.secure_url,
      url: cloudResult.secure_url,
      cloudinary_public_id: cloudResult.public_id,
      kind,
      mime_type: mimeType,
      original_filename: req.file.originalname || null,
    });
  } catch (err) {
    return next(err);
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
    err.expose = true;
    return next(err);
  }

  // If WABA ID is missing, we can't send via the standard flow easily,
  // but standard message sending usually relies on Phone Number ID, not WABA ID directly.
  // The 'sendTemplateMessage' function in whatsappClient should handle this.
  
  try {
    const resp = await whatsappClient.sendTemplateMessage(
      to,
      templateName,
      languageCode || 'en_US',
      components
    );
    res.json(resp.data);
  } catch (err) {
    // Surface Meta error details to the client instead of a generic message.
    const e = new Error(
      (err.response && err.response.error && err.response.error.message) ||
      err.message ||
      'Template send failed'
    );
    e.status = err.status || 500;
    e.expose = true;
    return next(e);
  }
});

/**
 * DELETE /api/templates
 * Delete a template by name (and optional hsm_id).
 */
router.delete('/', async (req, res, next) => {
  if (!WABA_ID) {
    const err = new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not configured');
    err.status = 500;
    return next(err);
  }
  
  const { name, hsm_id } = req.query;
  
  if (!name) {
    const err = new Error('Template "name" is required');
    err.status = 400;
    return next(err);
  }
  
  try {
    console.log(`[templates] Deleting template: ${name} (ID: ${hsm_id || 'ALL'})`);
    const resp = await whatsappClient.deleteTemplate(WABA_ID, name, hsm_id);
    res.json(resp.data || { success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
