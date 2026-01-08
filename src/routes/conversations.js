'use strict';
/**
 * src/routes/conversations.js
 *
 * Purpose:
 * - HTTP endpoints for conversation claim and admin reassignment.
 * - Validates inputs and delegates to service layer.
 * - Returns clear JSON responses and leverages centralized error handling.
 *
 * Locking/consistency is handled by the service using transactions and row-level locks.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/conversationClaim');
const auth = require('../middlewares/auth');

/**
 * POST /api/conversations/claim
 * Body: { conversationId: UUID, teamId: UUID, userId: UUID }
 *
 * Normal agent claim:
 * - If no active assignment, creates one.
 * - If already assigned to same user, returns idempotent success.
 * - If assigned to another user, returns 409.
 */
router.post('/claim', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId, teamId, userId } = req.body || {};
    if (!conversationId || !teamId) {
      const err = new Error('conversationId, teamId, and userId are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await svc.claimConversation(conversationId, teamId, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/conversations/reassign
 * Body: { conversationId: UUID, teamId: UUID, newAssigneeUserId: UUID, actorRole: 'admin' }
 *
 * Admin reassignment:
 * - Releases current active assignment (if any).
 * - Inserts new active assignment for provided user.
 */
router.post('/reassign', auth.requireRole('admin'), async (req, res, next) => {
  try {
    const { conversationId, teamId, newAssigneeUserId } = req.body || {};
    if (!conversationId || !teamId || !newAssigneeUserId) {
      const err = new Error('conversationId, teamId, newAssigneeUserId, and actorRole are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await svc.reassignConversation(conversationId, teamId, newAssigneeUserId, 'admin', req.user.id);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/release', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.body || {};
    if (!conversationId) {
      const err = new Error('conversationId is required');
      err.status = 400;
      err.expose = true;
      throw err;
    }
    const result = await svc.releaseConversation(conversationId, req.user.role, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
