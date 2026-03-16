'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');
const telegramClient = require('../integrations/telegram/telegramClient');

async function resolveTeamId(req) {
  if (req.query && req.query.teamId) return req.query.teamId;
  if (req.user && Array.isArray(req.user.teamIds) && req.user.teamIds.length > 0) {
    return req.user.teamIds[0];
  }
  return 'default';
}

/**
 * POST /api/auth/telegram/connect
 * Connect a Telegram bot to the team
 */
router.post('/connect', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  const { botToken, displayName } = req.body;
  const teamId = await resolveTeamId(req);

  if (!botToken) {
    return res.status(400).json({ error: 'Bot token is required' });
  }

  try {
    console.log('[Telegram Auth] Connecting bot with token:', botToken.substring(0, 10) + '...');

    // Verify bot token by calling getMe
    const botInfo = await telegramClient.getMe(botToken);
    
    if (!botInfo.data.ok || !botInfo.data.result) {
      return res.status(400).json({ 
        error: 'Invalid bot token',
        details: botInfo.data.description || 'Failed to verify bot'
      });
    }

    const bot = botInfo.data.result;
    const botUsername = bot.username || 'telegram_bot';
    const finalDisplayName = displayName || `Telegram - @${botUsername}`;

    console.log(`[Telegram Auth] Bot verified: @${botUsername} (${bot.first_name})`);

    // Save to database
    const result = await db.query(
      `
      INSERT INTO telegram_settings (team_id, bot_token, bot_username, display_name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (team_id, bot_token) DO UPDATE SET
        bot_username = EXCLUDED.bot_username,
        display_name = EXCLUDED.display_name,
        is_active = true,
        updated_at = NOW()
      RETURNING id, bot_token, bot_username, display_name
      `,
      [teamId, botToken, botUsername, finalDisplayName]
    );

    const setting = result.rows[0];

    // Set webhook (optional, for production use)
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    
    if (webhookUrl) {
      try {
        console.log(`[Telegram Auth] Setting webhook for bot @${botUsername}`);
        await telegramClient.setWebhook(botToken, webhookUrl, webhookSecret);
        console.log(`[Telegram Auth] Webhook set successfully`);
      } catch (webhookErr) {
        console.warn(`[Telegram Auth] Failed to set webhook:`, webhookErr.message);
        // Don't fail the connection if webhook setup fails
      }
    }

    res.json({
      success: true,
      data: {
        botToken: setting.bot_token,
        botUsername: setting.bot_username,
        displayName: setting.display_name,
        botInfo: {
          id: bot.id,
          firstName: bot.first_name,
          username: bot.username,
          isBot: bot.is_bot
        }
      }
    });
  } catch (err) {
    console.error('[Telegram Auth] Connection failed:', err.message);
    res.status(500).json({ 
      error: 'Failed to connect Telegram bot',
      details: err.message 
    });
  }
});

/**
 * GET /api/auth/telegram/settings
 * Get all Telegram settings for the team
 */
router.get('/settings', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    
    const result = await db.query(
      `
      SELECT id, bot_token, bot_username, display_name, is_active, created_at, updated_at
      FROM telegram_settings
      WHERE team_id = $1
      ORDER BY created_at DESC
      `,
      [teamId]
    );

    res.json({
      teamId,
      settings: result.rows,
      count: result.rowCount
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/auth/telegram/disconnect/:botToken
 * Disconnect a Telegram bot
 */
router.delete('/disconnect/:botToken', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  const { botToken } = req.params;
  const teamId = await resolveTeamId(req);

  try {
    // Delete webhook
    try {
      await telegramClient.deleteWebhook(botToken);
      console.log('[Telegram Auth] Webhook deleted');
    } catch (e) {
      console.warn('[Telegram Auth] Failed to delete webhook:', e.message);
    }

    // Mark as inactive in database
    const result = await db.query(
      `
      UPDATE telegram_settings
      SET is_active = false, updated_at = NOW()
      WHERE team_id = $1 AND bot_token = $2
      RETURNING id, bot_username, display_name
      `,
      [teamId, botToken]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Telegram bot not found' });
    }

    res.json({
      success: true,
      message: `Telegram bot @${result.rows[0].bot_username} disconnected`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
