'use strict';
const axios = require('axios');

function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

function generateOtp(digits) {
  const d = Number(digits);
  const size = Number.isFinite(d) ? d : 6;
  const clamped = Math.max(4, Math.min(10, size));
  const min = Math.pow(10, clamped - 1);
  const max = Math.pow(10, clamped) - 1;
  const n = Math.floor(min + Math.random() * (max - min + 1));
  return String(n);
}

async function sendOtpSms({ phoneNumber, otp }) {
  const apiKey = process.env.FAST_TWO_SMS || '';
  if (!apiKey) throw new Error('FAST_TWO_SMS is not set');
  const num = normalizePhone(phoneNumber);
  if (!num) throw new Error('Recipient phone number is missing');
  if (!otp) throw new Error('OTP is missing');

  const url = 'https://www.fast2sms.com/dev/bulkV2';
  const payload = {
    variables_values: String(otp),
    route: 'otp',
    numbers: num,
  };

  const resp = await axios.post(url, payload, {
    headers: {
      authorization: apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    timeout: 20000,
  });

  return resp.data;
}

module.exports = { sendOtpSms, generateOtp, normalizePhone };
