'use strict';
/**
 * src/routes/instagramOutbound.js
 *
 * Purpose:
 * - Defines HTTP endpoints for outbound Instagram messages: text DMs, media DMs.
 * - Validates input and delegates to the Instagram outbound service.
 */

const express = require('express');
const router = express.Router();
const service = require('../services/outboundInstagram');
const auth = require('../middlewares/auth');

/**
 * POST /api/instagram/text
 * Body: { conversationId: UUID, text: string }
 */
router.post('/text', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
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
 * POST /api/instagram/media
 * Body: { conversationId: UUID, kind: 'image'|'audio'|'document', url: string, caption?: string }
 */
router.post('/media', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
  try {
    const { conversationId, kind, url, caption } = req.body || {};
    if (!conversationId || !kind || !url) {
      const err = new Error('conversationId, kind, and url are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await service.sendMedia(conversationId, kind, url, caption);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
