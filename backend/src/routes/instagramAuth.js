'use strict';
const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const db = require('../../db');

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID || '1115102437313127';
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'https://inbox.xolox.io/api/auth/instagram/callback';

/**
 * GET /api/auth/instagram/callback
 * Endpoint for Instagram/Facebook Business Login Redirect.
 */
router.get('/instagram/callback', async (req, res) => {
  const { code, state, error, error_reason, error_description } = req.query;

  console.log('[Instagram Auth] Callback received:', req.query);

  if (error) {
    console.error('[Instagram Auth] Error:', error, error_reason, error_description);
    return res.status(400).send(`Instagram Login Error: ${error_description}`);
  }

  if (code) {
    try {
      if (!INSTAGRAM_CLIENT_SECRET) {
         return res.status(500).send('Server Error: INSTAGRAM_CLIENT_SECRET is not configured.');
      }

      // 1. Exchange Code for Short-Lived Access Token
      console.log('[Instagram Auth] Exchanging code for access token...');
      const form = new FormData();
      form.append('client_id', INSTAGRAM_CLIENT_ID);
      form.append('client_secret', INSTAGRAM_CLIENT_SECRET);
      form.append('grant_type', 'authorization_code');
      form.append('redirect_uri', INSTAGRAM_REDIRECT_URI);
      form.append('code', code);

      const tokenRes = await axios.post('https://api.instagram.com/oauth/access_token', form, {
        headers: form.getHeaders()
      });

      const { access_token, user_id } = tokenRes.data; // user_id here is the Instagram User ID (Scoped)
      console.log(`[Instagram Auth] Got short-lived token for user ${user_id}`);

      // 2. Exchange Short-Lived Token for Long-Lived Token (optional but recommended)
      console.log('[Instagram Auth] Exchanging for long-lived token...');
      const longLivedRes = await axios.get('https://graph.instagram.com/access_token', {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: INSTAGRAM_CLIENT_SECRET,
          access_token: access_token
        }
      });

      const longLivedToken = longLivedRes.data.access_token;
      const expiresIn = longLivedRes.data.expires_in;
      console.log(`[Instagram Auth] Got long-lived token. Expires in: ${expiresIn}`);

      // 3. Fetch User Details (Name, Username)
      // Note: We need the Instagram Professional Account ID, which is usually linked to a Facebook Page.
      // However, for Instagram Basic Display/Business Login, we might just get the IG User.
      // Let's fetch basic profile first.
      
      const userRes = await axios.get(`https://graph.instagram.com/${user_id}`, {
        params: {
          fields: 'id,username,account_type',
          access_token: longLivedToken
        }
      });
      
      const igUser = userRes.data;
      console.log('[Instagram Auth] User Profile:', igUser);

      // 4. Store in DB (upsert into channels table)
      // We'll treat this as a channel of type 'instagram'
      const channelName = igUser.username || `Instagram User ${user_id}`;
      
      // Store token in config
      const config = {
        accessToken: longLivedToken,
        tokenExpiresAt: Date.now() + (expiresIn * 1000),
        rawProfile: igUser
      };

      await db.query(`
        INSERT INTO channels (type, name, external_id, config, active)
        VALUES ('instagram', $1, $2, $3, true)
        ON CONFLICT (type, external_id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          config = channels.config || EXCLUDED.config,
          active = true,
          created_at = NOW() -- touch updated
      `, [channelName, String(user_id), config]);

      console.log('[Instagram Auth] Channel saved successfully.');

      // 5. Redirect to frontend with success
      // Assuming frontend is served on same domain or we know the URL.
      // For now, redirect to root or specific page.
      res.redirect('/instagram?connected=true');

    } catch (err) {
      console.error('[Instagram Auth] Token Exchange Failed:', err.message);
      if (err.response) {
        console.error('[Instagram Auth] Response:', err.response.data);
      }
      res.status(500).send('Authentication failed. Check server logs.');
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
      SELECT id, name, external_id, created_at 
      FROM channels 
      WHERE type = 'instagram' AND active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      res.json({ 
        connected: true, 
        channel: result.rows[0] 
      });
    } else {
      res.json({ connected: false });
    }
  } catch (err) {
    console.error('[Instagram Auth] Status Check Error:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

module.exports = router;
