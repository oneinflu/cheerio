'use strict';
const express = require('express');
const router = express.Router();
const svc = require('../services/inbox');
const auth = require('../middlewares/auth');

router.get('/inbox', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
  try {
    const teamId = (req.query && req.query.teamId) || (req.user.teamIds && req.user.teamIds[0]) || null;
    const filter = req.query.filter || 'open';
    const phoneNumberId = req.query.phoneNumberId || null;
    console.log(`[InboxRoute] GET /inbox teamId=${teamId} filter=${filter} phoneNumberId=${phoneNumberId}`);
    const list = await svc.listConversations(teamId, req.user.id, req.user.role, filter, phoneNumberId);

    res.status(200).json({ conversations: list });
  } catch (err) {
    return next(err);
  }
});

router.get('/inbox/counts', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
  try {
    const teamId = (req.query && req.query.teamId) || (req.user.teamIds && req.user.teamIds[0]) || null;
    const counts = await svc.getInboxCounts(teamId, req.user.id, req.user.role);
    res.status(200).json(counts);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
