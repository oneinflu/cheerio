'use strict';
const express = require('express');
const router = express.Router();

const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || '';

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN && VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Forbidden' });
});

router.post('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;

