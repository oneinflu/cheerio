'use strict';
const express = require('express');
const router = express.Router();
const whatsappClient = require('../integrations/meta/whatsappClient');
const axios = require('axios');
const db = require('../../db');
const waConfig = require('../utils/whatsappConfig');

/**
 * GET /api/media/:mediaId
 * Proxy to fetch media from WhatsApp Cloud API.
 */
router.get('/:mediaId', async (req, res, next) => {
  const { mediaId } = req.params;
  if (!mediaId) return res.status(400).send('Missing mediaId');

  try {
    // Attempt to find the correct token by looking up the media in our DB
    let customConfig = null;
    try {
      const resLookup = await db.query(
        `SELECT ch.external_id as phone_number_id
         FROM attachments a
         JOIN messages m ON m.id = a.message_id
         JOIN channels ch ON ch.id = m.channel_id
         WHERE a.url = $1 OR a.id::text = $1
         LIMIT 1`,
        [mediaId]
      );
      if (resLookup.rowCount > 0) {
        customConfig = await waConfig.getConfigByPhone(resLookup.rows[0].phone_number_id);
      }
    } catch (e) {
      console.warn('[MediaProxy] Failed to lookup media config:', e.message);
    }

    const token = (customConfig && customConfig.token) || process.env.WHATSAPP_TOKEN;

    // 1. Get the media URL
    const mediaRes = await whatsappClient.getMedia(mediaId, customConfig);
    if (!mediaRes || !mediaRes.data || !mediaRes.data.url) {
      return res.status(404).send('Media not found or URL missing');
    }

    const mediaUrl = mediaRes.data.url;
    const mimeType = mediaRes.data.mime_type;

    // 2. Fetch the media stream
    const response = await axios({
      method: 'get',
      url: mediaUrl,
      responseType: 'stream',
      headers: {
        'Authorization': `Bearer ${token}`
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

