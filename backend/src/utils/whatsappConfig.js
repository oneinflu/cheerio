'use strict';
const db = require('../../db');

// .env fallback token — always used when DB token is missing or expired
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const ENV_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ENV_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

function envFallback(overrides = {}) {
  return {
    phoneNumberId: ENV_PHONE_NUMBER_ID,
    businessAccountId: ENV_BUSINESS_ACCOUNT_ID,
    token: WHATSAPP_TOKEN,
    isCustom: false,
    ...overrides,
  };
}

/**
 * WhatsApp Config Utility
 * Fetches team-specific WhatsApp settings from the database.
 * Falls back to .env WHATSAPP_TOKEN if no DB settings are found.
 */
async function getConfig(teamId) {
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
          token: row.permanent_token || WHATSAPP_TOKEN,
          isCustom: true
        };
      }
    } catch (err) {
      console.warn(`[WhatsAppConfig] Failed to fetch settings for team ${teamId}:`, err.message);
    }
  }

  if (WHATSAPP_TOKEN && ENV_PHONE_NUMBER_ID) {
    return envFallback();
  }

  throw new Error('No active WhatsApp configuration found for this team. Please connect a number in Settings.');
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
          token: row.permanent_token || WHATSAPP_TOKEN,
          isCustom: true
        };
      }
    } catch (err) {
      console.warn(`[WhatsAppConfig] Failed to fetch settings for phone ${phoneNumberId}:`, err.message);
    }
  }

  if (WHATSAPP_TOKEN && ENV_PHONE_NUMBER_ID) {
    return envFallback({ phoneNumberId: phoneNumberId || ENV_PHONE_NUMBER_ID });
  }

  throw new Error('No active WhatsApp configuration found for this phone number. Please connect a number in Settings.');
}

async function getAllConfigs(teamId) {
  if (teamId) {
    try {
      const res = await db.query(
        'SELECT phone_number_id, business_account_id, permanent_token, display_phone_number FROM whatsapp_settings WHERE team_id = $1 AND is_active = true',
        [teamId]
      );
      if (res.rowCount > 0) {
        return res.rows.map(row => ({
          phoneNumberId: row.phone_number_id,
          businessAccountId: row.business_account_id,
          token: row.permanent_token || WHATSAPP_TOKEN,
          displayPhoneNumber: row.display_phone_number,
          isCustom: true
        }));
      }
    } catch (err) {
      console.warn(`[WhatsAppConfig] Failed to fetch all settings for team ${teamId}:`, err.message);
    }
  }

  if (WHATSAPP_TOKEN && ENV_PHONE_NUMBER_ID) {
    return [envFallback()];
  }
  return [];
}

module.exports = { getConfig, getConfigByPhone, getAllConfigs };

