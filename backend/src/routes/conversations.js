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
const db = require('../../db');
const axios = require('axios');

/**
 * GET /api/conversations/:conversationId/contact
 * Returns contact details (name, number, course)
 */
router.get('/:conversationId/contact', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const result = await db.query(
      `SELECT ct.id as contact_id, ct.display_name, ct.external_id, ct.profile
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       WHERE c.id = $1`,
      [conversationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const row = result.rows[0];
    const profile = row.profile || {};
    res.json({
      contactId: row.contact_id,
      name: row.display_name,
      number: row.external_id,
      course: profile.course || '',
      preferredLanguage: profile.preferred_language || '',
      blocked: profile.blocked === true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/conversations/:conversationId/contact
 * Updates contact details (name, course)
 */
router.put('/:conversationId/contact', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { name, course } = req.body;
    
    const cRes = await db.query('SELECT contact_id, lead_id FROM conversations WHERE id = $1', [conversationId]);
    if (cRes.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const contactId = cRes.rows[0].contact_id;
    let leadId = cRes.rows[0].lead_id;

    console.log(`[ContactUpdate] Updating contact ${contactId} (LeadID: ${leadId}) - Name: ${name}, Course: ${course}`);

    // If leadId is missing, try to find it or create one?
    // User says "pass the leadId and courseName na why not passing".
    // If we don't have leadId, we can't call PUT /leads/:id/course.
    // However, if we don't have leadId, maybe we should try to fetch it via webhook logic?
    // Or maybe it's null in DB?
    
    // Fetch contact details to get mobile number if needed for fallback lookup
    if (!leadId) {
         const ctRes = await db.query('SELECT external_id, display_name FROM contacts WHERE id = $1', [contactId]);
         if (ctRes.rows.length > 0) {
             let mobile = ctRes.rows[0].external_id;
             if (mobile.startsWith('91') && mobile.length > 10) mobile = mobile.slice(2);
             
             // Try to get lead via webhook mechanism or just proceed to update local DB
             console.warn(`[ContactUpdate] Warning: No lead_id linked to conversation ${conversationId}. External sync might fail.`);
             
             // Attempt to get leadId by creating/updating lead via webhook endpoint if possible?
             // Or check if we can search lead by mobile?
             // For now, we'll log it. If user insists on sync, we need leadId.
         }
    }

    await db.query(
      `UPDATE contacts 
       SET display_name = $1, 
           profile = jsonb_set(COALESCE(profile, '{}'), '{course}', to_jsonb($2::text), true)
       WHERE id = $3`,
      [name, course, contactId]
    );

    if (course) {
      // Even if leadId is null, we might want to try syncing if we can find the lead.
      // But assuming we have leadId if it was created via webhook.
      
      if (leadId) {
          console.log(`[ContactUpdate] Syncing course '${course}' to Starforze Lead ${leadId}...`);
          try {
            const resp = await axios.post(`https://api.starforze.com/api/leads/${leadId}/course`, {
              courseName: course
            });
            console.log(`[ContactUpdate] Sync success. Response status: ${resp.status}`);

            const leadData = resp.data && resp.data.data ? resp.data.data : null;
            const assignedTo = leadData && leadData.assignedTo ? leadData.assignedTo : null;
            const io = require('../realtime/io').getIO();

            if (assignedTo && (assignedTo._id || assignedTo.id || assignedTo.email)) {
              const userId = assignedTo._id || assignedTo.id;
              const teamId = leadData.teamId || null;

              if (userId) {
                const checkRes = await db.query(
                  'SELECT 1 FROM conversation_assignments WHERE conversation_id = $1 AND released_at IS NULL',
                  [conversationId]
                );

                if (checkRes.rowCount === 0) {
                  await db.query(
                    `INSERT INTO conversation_assignments (id, conversation_id, team_id, assignee_user_id, claimed_at)
                     VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
                    [conversationId, teamId, userId]
                  );
                  console.log(`[ContactUpdate] Auto-assigned conversation to ${userId}`);

                  if (io) {
                    io.to(`conversation:${conversationId}`).emit('assignment:claimed', { conversationId, userId });
                    io.emit('assignment:claimed', { conversationId, userId });
                  }
                }
              }
            }
          } catch (e) {
            console.error('[ContactUpdate] Failed to sync course/assignment with Starforze:', e.message);
            if (e.response) {
                console.error('[ContactUpdate] Response data:', e.response.data);
            }
          }
      } else {
          console.warn('[ContactUpdate] Skipping external sync: lead_id is missing.');
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

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

router.post('/:conversationId/pin', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    
    const check = await db.query('SELECT 1 FROM pinned_conversations WHERE user_id = $1 AND conversation_id = $2', [userId, conversationId]);
    if (check.rowCount > 0) {
      await db.query('DELETE FROM pinned_conversations WHERE user_id = $1 AND conversation_id = $2', [userId, conversationId]);
      res.json({ pinned: false });
    } else {
      await db.query('INSERT INTO pinned_conversations (user_id, conversation_id) VALUES ($1, $2)', [userId, conversationId]);
      res.json({ pinned: true });
    }
  } catch (err) {
    next(err);
  }
});

router.post('/:conversationId/status', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;
    
    let dbStatus = status;
    if (status === 'resolved') dbStatus = 'closed';
    
    if (!['open', 'closed', 'snoozed'].includes(dbStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await db.query('UPDATE conversations SET status = $1 WHERE id = $2', [dbStatus, conversationId]);
    res.json({ success: true, status: dbStatus });
  } catch (err) {
    next(err);
  }
});

router.post('/:conversationId/block', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conv = await db.query(
      `SELECT contact_id FROM conversations WHERE id = $1`,
      [conversationId]
    );
    if (conv.rowCount === 0) {
      const err = new Error('Conversation not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }
    const contactId = conv.rows[0].contact_id;

    await db.query(
      `
      UPDATE contacts
      SET profile = jsonb_set(
        COALESCE(profile, '{}'::jsonb),
        '{blocked}',
        'true'::jsonb,
        true
      )
      WHERE id = $1
      `,
      [contactId]
    );

    res.json({ success: true, blocked: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:conversationId/unblock', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conv = await db.query(
      `SELECT contact_id FROM conversations WHERE id = $1`,
      [conversationId]
    );
    if (conv.rowCount === 0) {
      const err = new Error('Conversation not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }
    const contactId = conv.rows[0].contact_id;

    await db.query(
      `
      UPDATE contacts
      SET profile = COALESCE(profile, '{}'::jsonb) - 'blocked'
      WHERE id = $1
      `,
      [contactId]
    );

    res.json({ success: true, blocked: false });
  } catch (err) {
    next(err);
  }
});

router.delete('/:conversationId', auth.requireRole('admin','agent','supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!conversationId) {
      const err = new Error('conversationId is required');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const result = await db.query(
      `DELETE FROM conversations WHERE id = $1 RETURNING id`,
      [conversationId]
    );
    if (result.rowCount === 0) {
      const err = new Error('Conversation not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }

    res.json({ success: true, conversationId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
