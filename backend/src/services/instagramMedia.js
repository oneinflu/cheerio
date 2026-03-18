'use strict';
/**
 * src/services/instagramMedia.js
 * 
 * Purpose:
 * - Fetches media (posts) from a connected Instagram Business Account.
 * - This allows users to see their posts and configure post-specific automations like Comment-to-DM.
 */

const axios = require('axios');
const db = require('../../db');

const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

async function fetchChannelMedia(channelId) {
  // 1. Get channel config/token
  const res = await db.query(
    `SELECT external_id, config FROM channels WHERE id = $1 AND type = 'instagram' AND active = true`,
    [channelId]
  );

  if (res.rowCount === 0) {
    throw new Error('Active Instagram channel not found');
  }

  const { external_id, config } = res.rows[0];
  const accessToken = config.accessToken || config.page_token;
  
  // Important: We must use the Instagram Business Account ID, NOT the Page ID
  // to access the /media edge.
  const targetId = config.igAccountId || external_id;

  if (!accessToken) {
    throw new Error('Access token missing for this channel. Please reconnect.');
  }

  // 2. Fetch media from Graph API
  try {
    const response = await axios.get(`${GRAPH_BASE}/${targetId}/media`, {
      params: {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,shortcode,like_count,comments_count',
        access_token: accessToken,
        limit: 24
      }
    });

    return response.data.data || [];
  } catch (err) {
    console.error('[Instagram Media Service] Fetch failed:', err.response?.data || err.message);
    throw new Error(err.response?.data?.error?.message || 'Failed to fetch Instagram media');
  }
}

module.exports = {
  fetchChannelMedia
};
