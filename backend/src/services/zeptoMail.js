'use strict';
const axios = require('axios');

const DEFAULT_BASE_URL = 'https://api.zeptomail.com';

function getAuthHeader(token) {
  const t = token || '';
  return `Zoho-enczapikey ${t}`.trim();
}

async function sendEmail({ toEmail, toName, subject, htmlbody, textbody, trackOpens = true, trackClicks = true }) {
  const token = process.env.ZEPTO_MAIL_TOKEN || '';
  const fromEmail = process.env.MAIL_FROM_EMAIL || '';
  const fromName = process.env.MAIL_FROM_NAME || '';
  const baseUrl = process.env.ZEPTO_MAIL_BASE_URL || DEFAULT_BASE_URL;

  if (!token) throw new Error('ZEPTO_MAIL_TOKEN is not set');
  if (!fromEmail) throw new Error('MAIL_FROM_EMAIL is not set');
  if (!toEmail) throw new Error('Recipient email is missing');
  if (!subject) throw new Error('Email subject is missing');
  if (!htmlbody && !textbody) throw new Error('Email body is missing');

  const payload = {
    from: { address: fromEmail, name: fromName || undefined },
    to: [
      {
        email_address: {
          address: toEmail,
          name: toName || undefined,
        },
      },
    ],
    subject,
    track_opens: Boolean(trackOpens),
    track_clicks: Boolean(trackClicks),
  };

  if (htmlbody) payload.htmlbody = htmlbody;
  if (textbody) payload.textbody = textbody;

  const url = `${baseUrl.replace(/\/+$/, '')}/v1.1/email`;

  const resp = await axios.post(url, payload, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(token),
    },
    timeout: 20000,
  });

  return resp.data;
}

module.exports = { sendEmail };
