'use strict';
const db = require('../../db');

/**
 * Telegram Config Utility
 * Fetches team-specific Telegram settings from the database.
 * Mirrors whatsappConfig.js structure
 */

async function getConfig(teamId) {
  if (teamId) {
    try {
      const res = await db.query(
        'SELECT bot_token, bot_username, display_name FROM telegram_settings WHERE team_id = $1 AND is_active = true LIMIT 1',
        [teamId]
      );
      if (res.rowCount > 0) {
        const row = res.rows[0];
        return {
          botToken: row.bot_token,
          botUsername: row.bot_username,
          displayName: row.display_name,
          isCustom: true
        };
      }
    } catch (err) {
      console.warn(`[TelegramConfig] Failed to fetch settings for team ${teamId}:`, err.message);
    }
  }

  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: '',
    displayName: 'Telegram Bot',
    isCustom: false
  };
}

async function getConfigByBot(botToken) {
  if (botToken) {
    try {
      const res = await db.query(
        'SELECT bot_username, display_name FROM telegram_settings WHERE bot_token = $1 AND is_active = true LIMIT 1',
        [botToken]
      );
      if (res.rowCount > 0) {
        const row = res.rows[0];
        return {
          botToken,
          botUsername: row.bot_username,
          displayName: row.display_name,
          isCustom: true
        };
      }
    } catch (err) {
      console.warn(`[TelegramConfig] Failed to fetch settings for bot ${botToken}:`, err.message);
    }
  }

  return {
    botToken: botToken || process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: '',
    displayName: 'Telegram Bot',
    isCustom: false
  };
}

async function getAllConfigs(teamId) {
  if (teamId) {
    try {
      const res = await db.query(
        'SELECT bot_token, bot_username, display_name FROM telegram_settings WHERE team_id = $1 AND is_active = true',
        [teamId]
      );
      return res.rows.map(row => ({
        botToken: row.bot_token,
        botUsername: row.bot_username,
        displayName: row.display_name,
        isCustom: true
      }));
    } catch (err) {
      console.warn(`[TelegramConfig] Failed to fetch all settings for team ${teamId}:`, err.message);
    }
  }
  return [];
}

module.exports = { getConfig, getConfigByBot, getAllConfigs };
