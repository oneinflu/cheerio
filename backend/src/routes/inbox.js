'use strict';
const express = require('express');
const router = express.Router();
const svc = require('../services/inbox');
const auth = require('../middlewares/auth');

router.get('/inbox', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const teamId = (req.query && req.query.teamId) || (req.user.teamIds && req.user.teamIds[0]) || null;
    const filter = req.query.filter || 'open';
    console.log(`[InboxRoute] GET /inbox teamId=${teamId} filter=${filter} query=${JSON.stringify(req.query)}`);
    const list = await svc.listConversations(teamId, req.user.id, req.user.role, filter);
    res.status(200).json({ conversations: list });
  } catch (err) {
    return next(err);
  }
});

router.get('/inbox/counts', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const teamId = (req.query && req.query.teamId) || (req.user.teamIds && req.user.teamIds[0]) || null;
    const counts = await svc.getInboxCounts(teamId, req.user.id);
    res.status(200).json(counts);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
