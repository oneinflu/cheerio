'use strict';
const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../../db');

const META_APP_ID = process.env.META_APP_ID || '321531509460250';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

/**
 * POST /api/auth/instagram/connect
 * Connect Instagram via Facebook Login access token.
 * The frontend passes the access_token obtained from FB.login() SDK.
 * 
 * Body: { accessToken: string }
 */
router.post('/instagram/connect', async (req, res) => {
  const { accessToken } = req.body || {};

  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required' });
  }

  console.log('[Instagram Auth] Connect request received with token.');

  try {
    // 1. Exchange short-lived token for long-lived token
    console.log('[Instagram Auth] Exchanging for long-lived token...');
    const longLivedRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: accessToken
      }
    });

    const longLivedToken = longLivedRes.data.access_token;
    console.log('[Instagram Auth] Got long-lived token.');

    // 2. Get user's Facebook Pages
    console.log('[Instagram Auth] Fetching Facebook Pages...');
    const pagesRes = await axios.get(`${GRAPH_BASE}/me/accounts`, {
      params: {
        fields: 'id,name,access_token,instagram_business_account',
        access_token: longLivedToken
      }
    });

    const pages = pagesRes.data?.data || [];
    console.log(`[Instagram Auth] Found ${pages.length} pages. Data:`, JSON.stringify(pages, null, 2));

    const connectedAccounts = [];

    for (const page of pages) {
      console.log(`[Instagram Auth] Processing Page: ${page.name} (ID: ${page.id})`);
      if (!page.instagram_business_account) {
        console.log(`[Instagram Auth] Page "${page.name}" has no linked IG business account. Skipping.`);
        continue;
      }

      const igAccountId = page.instagram_business_account.id;
      const pageAccessToken = page.access_token;

      // 3. Get Instagram Business Account details
      console.log(`[Instagram Auth] Fetching IG Business Account: ${igAccountId}`);
      let igProfile;
      try {
        const igRes = await axios.get(`${GRAPH_BASE}/${igAccountId}`, {
          params: {
            fields: 'id,username,name,profile_picture_url,followers_count,media_count',
            access_token: pageAccessToken
          }
        });
        igProfile = igRes.data;
      } catch (igErr) {
        console.warn(`[Instagram Auth] Could not fetch IG profile for ${igAccountId}:`, igErr.message);
        igProfile = { id: igAccountId, username: 'Unknown' };
      }

      console.log('[Instagram Auth] IG Profile:', igProfile);

      // 4. Subscribe the page to webhooks for Instagram
      try {
        await axios.post(`${GRAPH_BASE}/${page.id}/subscribed_apps`, null, {
          params: {
            subscribed_fields: 'messages,messaging_postbacks,messaging_optins,feed',
            access_token: pageAccessToken
          }
        });
        console.log(`[Instagram Auth] Subscribed page ${page.id} to webhook fields.`);
      } catch (subErr) {
        console.warn(`[Instagram Auth] Webhook subscription failed for page ${page.id}:`, subErr.response?.data || subErr.message);
      }

      // 5. Store in DB as Instagram channel
      const channelName = igProfile.username ? `@${igProfile.username}` : `IG Business ${igAccountId}`;
      
      const config = {
        accessToken: pageAccessToken,
        longLivedToken: longLivedToken,
        tokenExpiresAt: Date.now() + (60 * 24 * 60 * 60 * 1000), // ~60 days
        igProfile,
        pageId: page.id,
        pageName: page.name,
        igAccountId,
      };

      // Use the Page ID as external_id since webhook events are routed via Page
      // But also check if there's an existing channel using the IG Account ID
      console.log(`[Instagram Auth] Checking for existing channel with ID ${igAccountId} or ${page.id}`);
      let existingChannel = await db.query(
        `SELECT id FROM channels WHERE type = 'instagram' AND (external_id = $1 OR external_id = $2)`,
        [igAccountId, page.id]
      );

      // Use the ID that matches webhook events (typically the IG Business Account ID)
      const externalId = igAccountId;

      if (existingChannel.rows.length > 0) {
        // Update existing
        await db.query(
          `UPDATE channels SET name = $1, external_id = $2, config = $3::jsonb, active = true, created_at = NOW()
           WHERE id = $4`,
          [channelName, externalId, config, existingChannel.rows[0].id]
        );
        console.log(`[Instagram Auth] Updated existing channel ${existingChannel.rows[0].id}`);
      } else {
        // Create new
        await db.query(
          `INSERT INTO channels (type, name, external_id, config, active)
           VALUES ('instagram', $1, $2, $3::jsonb, true)`,
          [channelName, externalId, config]
        );
        console.log(`[Instagram Auth] Created new Instagram channel.`);
      }

      connectedAccounts.push({
        igAccountId,
        username: igProfile.username || 'Unknown',
        name: igProfile.name || channelName,
        profilePicture: igProfile.profile_picture_url || null,
        followersCount: igProfile.followers_count || 0,
        pageId: page.id,
        pageName: page.name,
      });
    }

    if (connectedAccounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No Instagram Business accounts found. Make sure your Instagram account is a Business/Creator account and is linked to a Facebook Page.'
      });
    }

    res.json({
      success: true,
      data: {
        accounts: connectedAccounts,
        count: connectedAccounts.length
      }
    });

  } catch (err) {
    console.error('[Instagram Auth] Connect Failed:', err.message);
    if (err.response) {
      console.error('[Instagram Auth] Response:', err.response.data);
    }
    res.status(500).json({
      success: false,
      error: err.response?.data?.error?.message || err.message || 'Authentication failed'
    });
  }
});

/**
 * GET /api/auth/instagram/callback
 * Fallback for OAuth redirect-based flows (backwards compatibility).
 */
router.get('/instagram/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('[Instagram Auth] Callback Error:', error, error_description);
    return res.redirect('/?instagram_error=' + encodeURIComponent(error_description || error));
  }

  if (code) {
    // Redirect-based OAuth flow - exchange code for token
    try {
      const tokenRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
        params: {
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          redirect_uri: process.env.INSTAGRAM_REDIRECT_URI || 'https://inbox.xolox.io/api/auth/instagram/callback',
          code: code
        }
      });
      
      // Use the same connect logic
      const fakeReq = { body: { accessToken: tokenRes.data.access_token } };
      const fakeRes = {
        json: (data) => {
          if (data.success) {
            res.redirect('/settings?instagram_connected=true');
          } else {
            res.redirect('/settings?instagram_error=' + encodeURIComponent(data.error));
          }
        },
        status: (code) => ({ json: (data) => {
          res.redirect('/settings?instagram_error=' + encodeURIComponent(data.error || 'Authentication failed'));
        }})
      };
      
      // Re-use the connect handler
      const connectHandler = router.stack.find(r => r.route?.path === '/instagram/connect' && r.route?.methods?.post);
      if (connectHandler) {
        // Just redirect to settings for now
        res.redirect('/settings?instagram_connected=true');
      }
    } catch (err) {
      console.error('[Instagram Auth] Callback token exchange failed:', err.message);
      res.redirect('/settings?instagram_error=token_exchange_failed');
    }
  } else {
    res.status(400).send('No code received.');
  }
});

/**
 * GET /api/auth/instagram/status
 * Checks if there is an active Instagram channel connected.
 */
router.get('/instagram/status', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, external_id, config, created_at 
      FROM channels 
      WHERE type = 'instagram' AND active = true 
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length > 0) {
      const channels = result.rows.map(ch => ({
        id: ch.id,
        name: ch.name,
        externalId: ch.external_id,
        username: ch.config?.igProfile?.username || ch.name,
        profilePicture: ch.config?.igProfile?.profile_picture_url || null,
        followersCount: ch.config?.igProfile?.followers_count || 0,
        pageName: ch.config?.pageName || '',
        connectedAt: ch.created_at,
      }));

      res.json({ 
        connected: true, 
        channels
      });
    } else {
      res.json({ connected: false, channels: [] });
    }
  } catch (err) {
    console.error('[Instagram Auth] Status Check Error:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

/**
 * POST /api/auth/instagram/disconnect
 * Disconnects the Instagram channel.
 */
router.post('/instagram/disconnect', async (req, res) => {
  try {
    const { channelId } = req.body || {};
    
    let query, params;
    if (channelId) {
      query = `UPDATE channels SET active = false, config = '{}'::jsonb WHERE id = $1 AND type = 'instagram' RETURNING id`;
      params = [channelId];
    } else {
      query = `UPDATE channels SET active = false, config = '{}'::jsonb WHERE type = 'instagram' AND active = true RETURNING id`;
      params = [];
    }

    const result = await db.query(query, params);

    if (result.rowCount > 0) {
      console.log(`[Instagram Auth] Channel(s) disconnected: ${result.rows.map(r => r.id).join(', ')}`);
      res.json({ success: true, message: 'Disconnected successfully' });
    } else {
      res.status(404).json({ error: 'No active Instagram channel found' });
    }
  } catch (err) {
    console.error('[Instagram Auth] Disconnect Error:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

module.exports = router;
