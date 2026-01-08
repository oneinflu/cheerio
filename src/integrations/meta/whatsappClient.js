'use strict';
/**
 * src/integrations/meta/whatsappClient.js
 *
 * Purpose:
 * - Minimal WhatsApp Cloud API client using Node's built-in https module.
 * - Supports sending text, media, and template messages via official Graph API.
 * - Adds a simple per-process rate limiter to avoid bursts (see comments).
 *
 * Rate limiting (explanation):
 * - Meta enforces rate limits per app/token and sometimes per phone number.
 * - We implement a basic limiter that spaces requests (e.g., 100ms apart).
 * - This does NOT guarantee full compliance across multiple processes/instances.
 * - In production, centralize rate limiting (e.g., Redis token bucket) to coordinate horizontally.
 * - If a request is rate-limited by Meta (HTTP 429), callers should back off and retry with exponential delays.
 */

const https = require('https');

const GRAPH_BASE = process.env.WHATSAPP_GRAPH_BASE || 'https://graph.facebook.com/v18.0';
const TOKEN = process.env.WHATSAPP_TOKEN || '';

// Simple in-memory limiter: one request every LAG_MS. Adjust with env as needed.
const LAG_MS = Number(process.env.WHATSAPP_RATE_LIMIT_MS || 100);
let nextAvailableTs = Date.now();

function delayUntilAvailable() {
  const now = Date.now();
  const wait = Math.max(0, nextAvailableTs - now);
  nextAvailableTs = now + wait + LAG_MS;
  return new Promise((resolve) => setTimeout(resolve, wait));
}

/**
 * POST JSON helper to Graph API.
 * Avoids adding external dependencies. Handles basic errors and JSON parsing.
 */
async function postJSON(url, body) {
  // Mock response for development/demo mode if no token is provided or explicit dev mode
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development' || !TOKEN || TOKEN === 'placeholder_token') {
    console.log('[Mock WhatsApp Client] Skipping real API call. Payload:', JSON.stringify(body, null, 2));
    await new Promise(r => setTimeout(r, 500)); // simulate network delay
    return {
      status: 200,
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: body.to, wa_id: body.to }],
        messages: [{ id: 'wamid.mock_' + Date.now() }]
      }
    };
  }

  await delayUntilAvailable();
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const opts = {
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const json = raw.length ? JSON.parse(raw) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            return resolve({ status: res.statusCode, data: json });
          }
          const err = new Error(`WhatsApp API error ${res.statusCode}`);
          err.status = res.statusCode;
          err.response = json;
          return reject(err);
        } catch (e) {
          return reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Send a text message.
 */
async function sendText(phoneNumberId, toWaId, text) {
  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: toWaId,
    type: 'text',
    text: { body: text },
  };
  return postJSON(url, payload);
}

/**
 * Send a media message (image/audio/document) via a public link.
 * If you prefer media IDs, adapt the payload accordingly.
 */
async function sendMedia(phoneNumberId, toWaId, kind, link, caption) {
  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: toWaId,
    type: kind, // 'image' | 'audio' | 'document'
    [kind]: { link },
  };
  if (caption && kind === 'image') {
    payload.image.caption = caption;
  } else if (caption && kind === 'document') {
    payload.document.caption = caption;
  }
  return postJSON(url, payload);
}

/**
 * Send a template message (for outside the 24-hour window).
 * Components allow variables (body parameters, etc.).
 */
async function sendTemplate(phoneNumberId, toWaId, name, languageCode, components) {
  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: toWaId,
    type: 'template',
    template: {
      name,
      language: { code: languageCode },
      components: components || [],
    },
  };
  return postJSON(url, payload);
}

module.exports = {
  sendText,
  sendMedia,
  sendTemplate,
};

