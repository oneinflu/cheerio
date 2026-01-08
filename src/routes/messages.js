'use strict';
const express = require('express');
const router = express.Router();
const svc = require('../services/messages');
const notesSvc = require('../services/staffNotes');
const auth = require('../middlewares/auth');

router.get('/conversations/:conversationId/messages', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const conversationId = req.params.conversationId;
    const messages = await svc.listMessages(conversationId);
    res.status(200).json({ messages });
  } catch (err) {
    return next(err);
  }
});

router.get('/conversations/:conversationId/notes', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const conversationId = req.params.conversationId;
    const notes = await notesSvc.listNotes(conversationId, req.user.role);
    res.status(200).json({ notes });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
