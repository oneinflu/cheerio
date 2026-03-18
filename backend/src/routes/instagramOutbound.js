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
const mediaService = require('../services/instagramMedia');
const auth = require('../middlewares/auth');

/**
 * POST /api/instagram/text
 * ...
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
 * GET /api/instagram/media-list
 * Query: ?channelId=UUID
 * Result: Array of media objects (id, caption, media_url, etc)
 */
router.get('/media-list', auth.requireRole('admin', 'supervisor', 'agent'), async (req, res, next) => {
  try {
    const { channelId, after } = req.query;
    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required' });
    }
    const result = await mediaService.fetchChannelMedia(channelId, after);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/instagram/media
 * ...
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
