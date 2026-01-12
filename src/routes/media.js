'use strict';
const express = require('express');
const router = express.Router();
const whatsappClient = require('../integrations/meta/whatsappClient');
const axios = require('axios');

/**
 * GET /api/media/:mediaId
 * Proxy to fetch media from WhatsApp Cloud API.
 * 
 * 1. Get media URL from Graph API (using mediaId).
 * 2. Download media from that URL (using Bearer token).
 * 3. Stream to client.
 */
router.get('/:mediaId', async (req, res, next) => {
  const { mediaId } = req.params;
  if (!mediaId) return res.status(400).send('Missing mediaId');

  try {
    // 1. Get the media URL
    const mediaRes = await whatsappClient.getMedia(mediaId);
    if (!mediaRes || !mediaRes.data || !mediaRes.data.url) {
      return res.status(404).send('Media not found or URL missing');
    }

    const mediaUrl = mediaRes.data.url;
    const mimeType = mediaRes.data.mime_type;

    // 2. Fetch the media stream
    // Note: The media URL requires the same Authorization header.
    const response = await axios({
      method: 'get',
      url: mediaUrl,
      responseType: 'stream',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    });

    // 3. Set headers and pipe
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    response.data.pipe(res);

  } catch (err) {
    console.error('Error proxying media:', err.message);
    if (err.response && err.response.status === 404) {
      return res.status(404).send('Media not found');
    }
    next(err);
  }
});

module.exports = router;
