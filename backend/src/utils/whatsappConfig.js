'use strict';
const db = require('../../db');

// .env fallback token — always used when DB token is missing or expired
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

function envFallback(overrides = {}) {
  return {
    phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: WHATSAPP_BUSINESS_ACCOUNT_ID,
    token: WHATSAPP_TOKEN,
    isCustom: false,
    ...overrides,
  };
}

/**
 * WhatsApp Config Utility
 * FORCED: Always returns .env values to ensure everything depends on .env only.
 */
function envFallback(overrides = {}) {
  return {
    phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: WHATSAPP_BUSINESS_ACCOUNT_ID,
    token: WHATSAPP_TOKEN,
    isCustom: false,
    ...overrides,
  };
}

async function getConfig(teamId) {
  if (WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
    return envFallback();
  }
  const e = new Error('No WhatsApp configuration found in .env');
  e.status = 400;
  e.expose = true;
  throw e;
}

async function getConfigByPhone(phoneNumberId) {
  return envFallback({ phoneNumberId: phoneNumberId || WHATSAPP_PHONE_NUMBER_ID });
}

async function getAllConfigs(teamId) {
  if (WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID) {
    return [envFallback()];
  }
  return [];
}

module.exports = { getConfig, getConfigByPhone, getAllConfigs };
