'use strict';
const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../../db');
const auth = require('../middlewares/auth');

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const APP_ID = process.env.WHATSAPP_APP_ID || process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

async function resolveTeamId(req) {
  if (req.query && req.query.teamId) return req.query.teamId;
  if (req.user && Array.isArray(req.user.teamIds) && req.user.teamIds.length > 0) {
    return req.user.teamIds[0];
  }
  return 'default';
}

/**
 * POST /api/auth/whatsapp/onboard
 * Handle callback from Embedded Signup (received via frontend popup)
 */
router.post('/onboard', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  const { accessToken } = req.body;
  const teamId = await resolveTeamId(req);

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token is required' });
  }

  try {
    // 1. Get WABA IDs associated with this token
    // Note: The token from embedded signup works for this user
    console.log('[WhatsApp Auth] Fetching WABAs for token...');
    const wabaRes = await axios.get(`${GRAPH_BASE}/me/whatsapp_business_accounts`, {
      params: { access_token: accessToken }
    });

    const wabas = wabaRes.data.data;
    if (!wabas || wabas.length === 0) {
      return res.status(404).json({ error: 'No WhatsApp Business Accounts found for this user' });
    }

    // Use the first WABA for now (or let user choose if multiple? For simplicity, we choose the first one)
    const waba = wabas[0];
    const businessAccountId = waba.id;
    console.log(`[WhatsApp Auth] Found WABA: ${businessAccountId} (${waba.name})`);

    // 2. Fetch phone numbers for this WABA
    const phoneRes = await axios.get(`${GRAPH_BASE}/${businessAccountId}/phone_numbers`, {
      params: { access_token: accessToken }
    });

    const phones = phoneRes.data.data;
    if (!phones || phones.length === 0) {
      return res.status(404).json({ error: 'No phone numbers found for this Business Account' });
    }

    const phone = phones[0];
    const phoneNumberId = phone.id;
    const displayPhoneNumber = phone.display_phone_number;
    console.log(`[WhatsApp Auth] Found Phone Number ID: ${phoneNumberId} (${displayPhoneNumber})`);

    // 3. Upsert into whatsapp_settings
    // Note: We are using the user's access token here. 
    // IMPORTANT: User tokens expire. Usually, we'd exchange for long-lived, 
    // but WhatsApp Business API often prefers a "System User Token" for truly permanent access.
    // However, if we just want to "fetch the data", we can save these and ask user for a permanent token 
    // OR we can try to use this token for now.
    
    await db.query(`
      INSERT INTO whatsapp_settings (team_id, phone_number_id, business_account_id, permanent_token, display_phone_number, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (team_id) DO UPDATE SET
        phone_number_id = EXCLUDED.phone_number_id,
        business_account_id = EXCLUDED.business_account_id,
        permanent_token = EXCLUDED.permanent_token,
        display_phone_number = EXCLUDED.display_phone_number,
        is_active = true,
        updated_at = NOW()
    `, [teamId, phoneNumberId, businessAccountId, accessToken, displayPhoneNumber]);

    res.json({
      success: true,
      data: {
        businessAccountId,
        phoneNumberId,
        displayPhoneNumber
      }
    });

  } catch (err) {
    console.error('[WhatsApp Auth] Onboarding failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to complete WhatsApp onboarding', details: err.response?.data });
  }
});

module.exports = router;
