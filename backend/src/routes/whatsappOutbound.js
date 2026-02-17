'use strict';
/**
 * src/routes/whatsappOutbound.js
 *
 * Purpose:
 * - Defines HTTP endpoints for outbound WhatsApp messages: text, media, template.
 * - Validates basic input and delegates to service layer.
 * - Shapes HTTP responses and leverages centralized error handling for failures.
 *
 * Rate limiting note:
 * - The integration client spaces requests to avoid bursts.
 * - If Meta returns 429, we propagate an error so callers can retry with backoff.
 */

const express = require('express');
const router = express.Router();
const service = require('../services/outboundWhatsApp');
const auth = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const db = require('../../db');

/**
 * POST /api/whatsapp/text
 * Body: { conversationId: UUID, text: string }
 */
router.post('/text', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId, text } = req.body || {};
    if (!conversationId || !text) {
      const err = new Error('conversationId and text are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await service.sendText(conversationId, text);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/whatsapp/media
 * Body: { conversationId: UUID, kind: 'image'|'audio'|'document', link: string, caption?: string }
 */
router.post('/media', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId, kind, link, caption } = req.body || {};
    if (!conversationId || !kind || !link) {
      const err = new Error('conversationId, kind, and link are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    if (!['image', 'audio', 'document'].includes(kind)) {
      const err = new Error('kind must be image, audio, or document');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await service.sendMedia(conversationId, kind, link, caption);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/whatsapp/template
 * Body: { conversationId: UUID, name: string, languageCode: string, components?: array }
 */
router.post('/template', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId, name, languageCode, components } = req.body || {};
    if (!conversationId || !name || !languageCode) {
      const err = new Error('conversationId, name, and languageCode are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await service.sendTemplate(conversationId, name, languageCode, components);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/whatsapp/upload
 * Form-Data: conversationId, file
 * Uploads media to WhatsApp and returns the media ID.
 */
router.post('/upload', auth.requireRole('admin','agent','supervisor'), upload.single('file'), async (req, res, next) => {
  try {
    const { conversationId } = req.body;
    if (!conversationId || !req.file) {
      const err = new Error('conversationId and file are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await service.uploadMedia(conversationId, req.file.buffer, req.file.mimetype, req.file.originalname);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/media-library', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const limitParam = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(limitParam) ? 20 : Math.min(Math.max(limitParam, 1), 100);
    const client = await db.getClient();
    try {
      const result = await client.query(
        `
        SELECT
          id,
          kind,
          url,
          mime_type,
          original_filename,
          created_at
        FROM media_assets
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit]
      );
      res.status(200).json({ data: result.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
