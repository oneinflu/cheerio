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
const axios = require('axios');
const FormData = require('form-data');

const GRAPH_BASE = process.env.WHATSAPP_GRAPH_BASE || 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.WHATSAPP_TOKEN || '';
const USE_MOCK = String(process.env.WHATSAPP_USE_MOCK || '').toLowerCase() === 'true';

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
  if (USE_MOCK) {
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
  if (!TOKEN || TOKEN === 'placeholder_token') {
    const err = new Error('WHATSAPP_TOKEN is required for real WhatsApp API calls');
    err.status = 500;
    throw err;
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
          const msg = json.error && json.error.message ? json.error.message : 'Unknown error';
          const err = new Error(`WhatsApp API error ${res.statusCode}: ${msg}`);
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
 * Send a template message.
 * @param {string} to - Recipient phone number (E.164 without +)
 * @param {string} templateName - Name of the template to send
 * @param {string} languageCode - Language code (e.g., 'en_US')
 * @param {Array} components - Optional: Template components (variables, buttons)
 * @param {string} phoneId - Optional: Phone number ID to send from
 */
async function sendTemplateMessage(to, templateName, languageCode = 'en_US', components = [], phoneId) {
  // Use provided phoneId or fallback to env/default
  const pid = phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID || '342847945577237';
  if (!pid) throw new Error('WHATSAPP_PHONE_NUMBER_ID is required');

  const url = `${GRAPH_BASE}/${pid}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: components || []
    }
  };
  console.log(`[WhatsAppClient] sending to URL: ${url}`);
  return postJSON(url, body);
}

/**
 * GET JSON helper to Graph API.
 */
async function getJSON(url) {
  if (USE_MOCK) {
    console.log('[Mock WhatsApp Client] Skipping real API call. GET', url);
    await new Promise(r => setTimeout(r, 500)); 
    return {
      status: 200,
      data: { data: [] }
    };
  }
  if (!TOKEN || TOKEN === 'placeholder_token') {
    const err = new Error('WHATSAPP_TOKEN is required for real WhatsApp API calls');
    err.status = 500;
    throw err;
  }

  await delayUntilAvailable();
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      method: 'GET',
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
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
    req.end();
  });
}

/**
 * Send a sender action (e.g. typing_on, typing_off).
 */
async function sendSenderAction(phoneNumberId, toWaId, action) {
  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;
  return postJSON(url, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId,
    type: 'sender_action',
    sender_action: action,
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
 * Send a media message (image/audio/document) via a public link or media ID.
 */
async function sendMedia(phoneNumberId, toWaId, kind, linkOrId, caption) {
  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;
  
  const mediaObj = {};
  if (linkOrId.match(/^https?:\/\//)) {
    mediaObj.link = linkOrId;
  } else {
    mediaObj.id = linkOrId;
  }

  if (caption && kind !== 'audio') {
    mediaObj.caption = caption;
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: toWaId,
    type: kind, // 'image' | 'audio' | 'document'
    [kind]: mediaObj,
  };

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

/**
 * Get templates for a WABA.
 */
async function getTemplates(wabaId, limit = 100) {
  const url = `${GRAPH_BASE}/${wabaId}/message_templates?limit=${limit}`;
  return getJSON(url);
}

/**
 * Create a new template.
 */
async function createTemplate(wabaId, templateData) {
  const url = `${GRAPH_BASE}/${wabaId}/message_templates`;
  return postJSON(url, templateData);
}

/**
 * Get media URL by ID.
 * Returns the object containing the temporary URL.
 */
async function getMedia(mediaId) {
  const url = `${GRAPH_BASE}/${mediaId}`;
  return getJSON(url);
}

/**
 * Upload media to WhatsApp Cloud API.
 * @param {string} phoneNumberId
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {string} filename
 */
async function uploadMedia(phoneNumberId, fileBuffer, mimeType, filename) {
  if (USE_MOCK) {
    console.log('[Mock WhatsApp Client] Skipping real upload.');
    return { id: 'mock_media_' + Date.now() };
  }
  if (!TOKEN) throw new Error('WHATSAPP_TOKEN required');

  const url = `${GRAPH_BASE}/${phoneNumberId}/media`;
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', fileBuffer, { filename, contentType: mimeType });
  form.append('type', mimeType);

  try {
    const res = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    return res.data; // { id: '...' }
  } catch (err) {
    throw new Error(`Upload failed: ${err.response?.data?.error?.message || err.message}`);
  }
}

/**
 * Upload media specifically for Message Templates (to get a handle).
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {string} filename
 */
async function uploadMessageTemplateMedia(wabaId, fileBuffer, mimeType, filename) {
  if (USE_MOCK) {
    console.log('[Mock WhatsApp Client] Skipping real template media upload.');
    return { h: 'mock_handle_' + Date.now() };
  }
  if (!TOKEN) throw new Error('WHATSAPP_TOKEN required');

  const url = `${GRAPH_BASE}/${wabaId}/message_template_media`;
  const form = new FormData();
  form.append('file', fileBuffer, { filename, contentType: mimeType });
  if (mimeType) {
    form.append('type', mimeType);
  }
  form.append('messaging_product', 'whatsapp');
  
  try {
    const res = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    // Response should contain { "h": "<HEADER_HANDLE>" }
    return res.data; 
  } catch (err) {
    throw new Error(`Template Media Upload failed: ${err.response?.data?.error?.message || err.message}`);
  }
}

/**
 * Delete a message template.
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {string} name - Name of the template (required)
 * @param {string} hsmId - Optional: Template ID to delete specific version
 */
async function deleteTemplate(wabaId, name, hsmId) {
  if (USE_MOCK) {
    console.log('[Mock WhatsApp Client] Deleting template:', name, hsmId);
    return { success: true };
  }
  if (!TOKEN) throw new Error('WHATSAPP_TOKEN required');

  await delayUntilAvailable();
  
  const u = new URL(`${GRAPH_BASE}/${wabaId}/message_templates`);
  u.searchParams.append('name', name);
  if (hsmId) {
    u.searchParams.append('hsm_id', hsmId);
  }

  return new Promise((resolve, reject) => {
    const opts = {
      method: 'DELETE',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
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
          const msg = json.error && json.error.message ? json.error.message : 'Unknown error';
          const err = new Error(`WhatsApp API error ${res.statusCode}: ${msg}`);
          err.status = res.statusCode;
          err.response = json;
          return reject(err);
        } catch (e) {
          return reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  sendText,
  sendMedia,
  sendTemplate,
  sendSenderAction,
  getTemplates,
  createTemplate,
  deleteTemplate,
  sendTemplateMessage,
  getMedia,
  uploadMedia,
  uploadMessageTemplateMedia,
};
