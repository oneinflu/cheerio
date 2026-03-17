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
    // We'll try multiple ways to find them as Graph API can be inconsistent with field availability
    console.log('[WhatsApp Auth] Exhaustive Search for WABAs starting...');
    let wabas = [];
    const seenIds = new Set();

    function addWabas(list) {
      if (!list || !Array.isArray(list)) return;
      list.forEach(item => {
        if (item.id && !seenIds.has(item.id)) {
          wabas.push(item);
          seenIds.add(item.id);
        }
      });
    }

    // Attempt 1: me/whatsapp_business_accounts
    try {
      const res = await axios.get(`${GRAPH_BASE}/me/whatsapp_business_accounts`, {
        params: { access_token: accessToken }
      });
      console.log(`[WhatsApp Auth] me/wabas found: ${res.data?.data?.length || 0}`);
      addWabas(res.data?.data);
    } catch (e) {
      console.log('[WhatsApp Auth] Attempt 1 failed:', e.message);
    }

    // Attempt 2: me?fields=whatsapp_business_accounts
    try {
      const res = await axios.get(`${GRAPH_BASE}/me`, {
        params: { 
          fields: 'whatsapp_business_accounts{id,name,currency,timezone_id},owned_whatsapp_business_accounts{id,name}',
          access_token: accessToken 
        }
      });
      console.log(`[WhatsApp Auth] me fields found: waba=${res.data?.whatsapp_business_accounts?.data?.length || 0}, owned=${res.data?.owned_whatsapp_business_accounts?.data?.length || 0}`);
      addWabas(res.data?.whatsapp_business_accounts?.data);
      addWabas(res.data?.owned_whatsapp_business_accounts?.data);
    } catch (e) {
      console.log('[WhatsApp Auth] Attempt 2 failed:', e.message);
    }

    // Attempt 3: Fetch all businesses and check each
    try {
      console.log('[WhatsApp Auth] Fetching businesses for discovery...');
      const bizRes = await axios.get(`${GRAPH_BASE}/me/businesses`, {
        params: { access_token: accessToken }
      });
      const businesses = bizRes.data.data || [];
      console.log(`[WhatsApp Auth] Found ${businesses.length} businesses to scan`);
      
      for (const biz of businesses) {
        console.log(`[WhatsApp Auth] Scanning business: ${biz.name} (${biz.id})`);
        
        // Scan owned
        try {
          const ownedRes = await axios.get(`${GRAPH_BASE}/${biz.id}/owned_whatsapp_business_accounts`, {
            params: { access_token: accessToken }
          });
          console.log(`[WhatsApp Auth] Business ${biz.id} owned WABAs: ${ownedRes.data?.data?.length || 0}`);
          addWabas(ownedRes.data?.data);
        } catch (e) {
          console.log(`[WhatsApp Auth] Business ${biz.id} owned check failed:`, e.message);
        }

        // Scan client/shared
        try {
          const clientRes = await axios.get(`${GRAPH_BASE}/${biz.id}/client_whatsapp_business_accounts`, {
            params: { access_token: accessToken }
          });
          console.log(`[WhatsApp Auth] Business ${biz.id} client WABAs: ${clientRes.data?.data?.length || 0}`);
          addWabas(clientRes.data?.data);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.log('[WhatsApp Auth] Attempt 3 (businesses) failed:', e.message);
    }

    if (wabas.length === 0) {
      console.error('[WhatsApp Auth] NO WABAs FOUND AFTER EXHAUSTIVE SEARCH');
      return res.status(404).json({ 
        error: 'No WhatsApp Business Accounts found', 
        message: 'We could not find any WhatsApp Business Accounts associated with your Facebook profile. Please ensure you have a WABA in a Meta Business Suite and you selected it in the popup.' 
      });
    }

    console.log(`[WhatsApp Auth] Success! Found ${wabas.length} unique WABAs. Using the first one: ${wabas[0].id}`);


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

    console.log(`[WhatsApp Auth] Found ${phones.length} phone numbers for WABA ${businessAccountId}`);

    // If there's only one phone number, we can auto-upsert it for backward compatibility
    // but we should still return the full list.
    if (phones.length === 1) {
      const phone = phones[0];
      const phoneNumberId = phone.id;
      const displayPhoneNumber = phone.display_phone_number;

      await db.query(`
        INSERT INTO whatsapp_settings (team_id, phone_number_id, business_account_id, permanent_token, display_phone_number, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (team_id, phone_number_id) DO UPDATE SET
          permanent_token = EXCLUDED.permanent_token,
          display_phone_number = EXCLUDED.display_phone_number,
          is_active = true,
          updated_at = NOW()
      `, [teamId, phoneNumberId, businessAccountId, accessToken, displayPhoneNumber]);

      // 3. IMPORTANT: Subscribe our App to the WABA's webhooks
      // Without this, Meta will NOT send us message events (the "automatic" part)
      try {
        console.log(`[WhatsApp Auth] Subscribing app to WABA: ${businessAccountId}`);
        await axios.post(`${GRAPH_BASE}/${businessAccountId}/subscribed_apps`, null, {
          params: { access_token: accessToken }
        });
        console.log(`[WhatsApp Auth] Successfully subscribed to WABA: ${businessAccountId}`);
      } catch (subErr) {
        console.warn(`[WhatsApp Auth] Subscription failed for WABA ${businessAccountId}:`, subErr.response?.data || subErr.message);
        // We don't fail the whole request as templating might still work
      }
    }

    res.json({
      success: true,
      data: {
        businessAccountId,
        phones: phones.map(p => ({
          id: p.id,
          displayPhoneNumber: p.display_phone_number,
          verifiedName: p.verified_name,
          qualityRating: p.quality_rating
        })),
        accessToken // Return token so frontend can use it if they need to select multiple
      }
    });


  } catch (err) {
    console.error('[WhatsApp Auth] Onboarding failed:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to complete WhatsApp onboarding', details: err.response?.data });
  }
});

module.exports = router;
