'use strict';
const db = require('../../db');

/**
 * WhatsApp Config Utility
 * Fetches team-specific WhatsApp settings from the database.
 * Falls back to environment variables if no settings are found for the team.
 */
async function getConfig(teamId) {
  // Try to fetch from DB first
  if (teamId) {
    try {
      const res = await db.query(
        'SELECT phone_number_id, business_account_id, permanent_token FROM whatsapp_settings WHERE team_id = $1 AND is_active = true LIMIT 1',
        [teamId]
      );
      if (res.rowCount > 0) {
        const row = res.rows[0];
        return {
          phoneNumberId: row.phone_number_id,
          businessAccountId: row.business_account_id,
          token: row.permanent_token,
          isCustom: true
        };
      }
    } catch (err) {
      console.warn(`[WhatsAppConfig] Failed to fetch settings for team ${teamId}:`, err.message);
    }
  }

  // Fallback to environment variables
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '342847945577237',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    token: process.env.WHATSAPP_TOKEN || '',
    isCustom: false
  };
}

async function getConfigByPhone(phoneNumberId) {
  if (phoneNumberId) {
    try {
      const res = await db.query(
        'SELECT business_account_id, permanent_token FROM whatsapp_settings WHERE phone_number_id = $1 AND is_active = true LIMIT 1',
        [phoneNumberId]
      );
      if (res.rowCount > 0) {
        const row = res.rows[0];
        return {
          phoneNumberId,
          businessAccountId: row.business_account_id,
          token: row.permanent_token,
          isCustom: true
        };
      }
    } catch (err) {
      console.warn(`[WhatsAppConfig] Failed to fetch settings for phone ${phoneNumberId}:`, err.message);
    }
  }

  // Fallback
  const defaultPid = process.env.WHATSAPP_PHONE_NUMBER_ID || '342847945577237';
  return {
    phoneNumberId: phoneNumberId || defaultPid,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    token: process.env.WHATSAPP_TOKEN || '',
    isCustom: false
  };
}

async function getAllConfigs(teamId) {
  if (teamId) {
    try {
      const res = await db.query(
        'SELECT phone_number_id, business_account_id, permanent_token, display_phone_number FROM whatsapp_settings WHERE team_id = $1 AND is_active = true',
        [teamId]
      );
      return res.rows.map(row => ({
        phoneNumberId: row.phone_number_id,
        businessAccountId: row.business_account_id,
        token: row.permanent_token,
        displayPhoneNumber: row.display_phone_number,
        isCustom: true
      }));
    } catch (err) {
      console.warn(`[WhatsAppConfig] Failed to fetch all settings for team ${teamId}:`, err.message);
    }
  }
  return [];
}

module.exports = { getConfig, getConfigByPhone, getAllConfigs };

