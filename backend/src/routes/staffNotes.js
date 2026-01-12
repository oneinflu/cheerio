'use strict';
const express = require('express');
const router = express.Router();
const svc = require('../services/staffNotes');
const auth = require('../middlewares/auth');

router.get('/conversations/:conversationId/notes', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const conversationId = req.params.conversationId;
    if (!conversationId) {
      const err = new Error('conversationId and actorRole are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const notes = await svc.listNotes(conversationId, req.user.role);
    res.status(200).json({ notes });
  } catch (err) {
    return next(err);
  }
});

router.post('/conversations/:conversationId/notes', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const conversationId = req.params.conversationId;
    const { body } = req.body || {};
    if (!conversationId || !req.user.id || !body) {
      const err = new Error('conversationId, actorRole, authorUserId, and body are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await svc.createNote(conversationId, req.user.id, body, req.user.role);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.put('/notes/:noteId', auth.requireRole('admin'), async (req, res, next) => {
  try {
    const noteId = req.params.noteId;
    const { body } = req.body || {};
    if (!noteId || !req.user.id || !body) {
      const err = new Error('noteId, actorRole, actorUserId, and body are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await svc.updateNote(noteId, body, req.user.role, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.delete('/notes/:noteId', auth.requireRole('admin'), async (req, res, next) => {
  try {
    const noteId = req.params.noteId;
    if (!noteId || !req.user.id) {
      const err = new Error('noteId, actorRole, and actorUserId are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await svc.deleteNote(noteId, req.user.role, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
