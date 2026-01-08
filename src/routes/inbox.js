'use strict';
const express = require('express');
const router = express.Router();
const svc = require('../services/inbox');
const auth = require('../middlewares/auth');

router.get('/inbox', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const teamId = (req.query && req.query.teamId) || (req.user.teamIds && req.user.teamIds[0]) || null;
    const list = await svc.listConversations(teamId);
    res.status(200).json({ conversations: list });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
