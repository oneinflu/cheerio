'use strict';
/**
 * src/integrations/telegram/telegramClient.js
 *
 * Purpose:
 * - Minimal Telegram Bot API client using Node's built-in https module.
 * - Supports sending text, media, and other message types via Telegram Bot API.
 * - Handles rate limiting and error handling.
 *
 * Telegram Bot API Documentation:
 * - https://core.telegram.org/bots/api
 * - Base URL: https://api.telegram.org/bot{token}/method
 */

const https = require('https');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const USE_MOCK = String(process.env.TELEGRAM_USE_MOCK || '').toLowerCase() === 'true';
const LAG_MS = Number(process.env.TELEGRAM_RATE_LIMIT_MS || 100);
let nextAvailableTs = Date.now();

function delayUntilAvailable() {
  const now = Date.now();
  const wait = Math.max(0, nextAvailableTs - now);
  nextAvailableTs = now + wait + LAG_MS;
  return new Promise((resolve) => setTimeout(resolve, wait));
}

/**
 * Make a request to Telegram Bot API
 */
async function makeRequest(botToken, method, params = {}, isFormData = false) {
  if (!botToken || botToken === 'placeholder_token') {
    const err = new Error('Telegram Bot Token is required');
    err.status = 500;
    throw err;
  }

  if (USE_MOCK) {
    console.log(`[Mock Telegram Client] ${method}:`, params);
    await new Promise(r => setTimeout(r, 300));
    return {
      status: 200,
      data: {
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 1000000),
          chat: { id: params.chat_id },
          text: params.text || '',
          date: Math.floor(Date.now() / 1000)
        }
      }
    };
  }

  await delayUntilAvailable();

  const url = `https://api.telegram.org/bot${botToken}/${method}`;

  try {
    let response;
    if (isFormData) {
      response = await axios.post(url, params, {
        headers: params.getHeaders ? params.getHeaders() : {}
      });
    } else {
      response = await axios.post(url, params);
    }

    if (response.data && response.data.ok) {
      return { status: 200, data: response.data };
    } else {
      const err = new Error(`Telegram API error: ${response.data?.description || 'Unknown error'}`);
      err.status = 400;
      err.response = response.data;
      throw err;
    }
  } catch (err) {
    if (err.response) {
      const msg = err.response.data?.description || err.message;
      const error = new Error(`Telegram API error: ${msg}`);
      error.status = err.response.status || 400;
      error.response = err.response.data;
      throw error;
    }
    throw err;
  }
}

/**
 * Send a text message
 */
async function sendText(botToken, chatId, text, parseMode = 'HTML') {
  const params = {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode
  };
  return makeRequest(botToken, 'sendMessage', params);
}

/**
 * Send a photo
 */
async function sendPhoto(botToken, chatId, photoUrl, caption = '', parseMode = 'HTML') {
  const params = {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption,
    parse_mode: parseMode
  };
  return makeRequest(botToken, 'sendPhoto', params);
}

/**
 * Send a document
 */
async function sendDocument(botToken, chatId, documentUrl, caption = '', parseMode = 'HTML') {
  const params = {
    chat_id: chatId,
    document: documentUrl,
    caption: caption,
    parse_mode: parseMode
  };
  return makeRequest(botToken, 'sendDocument', params);
}

/**
 * Send an audio file
 */
async function sendAudio(botToken, chatId, audioUrl, caption = '', parseMode = 'HTML') {
  const params = {
    chat_id: chatId,
    audio: audioUrl,
    caption: caption,
    parse_mode: parseMode
  };
  return makeRequest(botToken, 'sendAudio', params);
}

/**
 * Send a video
 */
async function sendVideo(botToken, chatId, videoUrl, caption = '', parseMode = 'HTML') {
  const params = {
    chat_id: chatId,
    video: videoUrl,
    caption: caption,
    parse_mode: parseMode
  };
  return makeRequest(botToken, 'sendVideo', params);
}

/**
 * Send typing indicator
 */
async function sendChatAction(botToken, chatId, action = 'typing') {
  const params = {
    chat_id: chatId,
    action: action
  };
  return makeRequest(botToken, 'sendChatAction', params);
}

/**
 * Get bot info
 */
async function getMe(botToken) {
  return makeRequest(botToken, 'getMe', {});
}

/**
 * Get updates (for polling, not recommended for production)
 */
async function getUpdates(botToken, offset = 0, limit = 100) {
  const params = {
    offset: offset,
    limit: limit,
    timeout: 30
  };
  return makeRequest(botToken, 'getUpdates', params);
}

/**
 * Set webhook
 */
async function setWebhook(botToken, webhookUrl, secretToken = '') {
  const params = {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ['message', 'edited_message', 'callback_query']
  };
  return makeRequest(botToken, 'setWebhook', params);
}

/**
 * Delete webhook
 */
async function deleteWebhook(botToken) {
  return makeRequest(botToken, 'deleteWebhook', {});
}

/**
 * Get webhook info
 */
async function getWebhookInfo(botToken) {
  return makeRequest(botToken, 'getWebhookInfo', {});
}

/**
 * Edit message text
 */
async function editMessageText(botToken, chatId, messageId, text, parseMode = 'HTML') {
  const params = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: parseMode
  };
  return makeRequest(botToken, 'editMessageText', params);
}

/**
 * Delete message
 */
async function deleteMessage(botToken, chatId, messageId) {
  const params = {
    chat_id: chatId,
    message_id: messageId
  };
  return makeRequest(botToken, 'deleteMessage', params);
}

module.exports = {
  sendText,
  sendPhoto,
  sendDocument,
  sendAudio,
  sendVideo,
  sendChatAction,
  getMe,
  getUpdates,
  setWebhook,
  deleteWebhook,
  getWebhookInfo,
  editMessageText,
  deleteMessage,
  makeRequest
};
