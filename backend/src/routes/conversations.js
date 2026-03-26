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

function resolveTeamId(req) {
  if (req.query && req.query.teamId) return req.query.teamId;
  if (req.user && Array.isArray(req.user.teamIds) && req.user.teamIds.length > 0) {
    return req.user.teamIds[0];
  }
  return null;
}

/**
 * GET /api/conversations/:conversationId/contact
 * Returns contact details (name, number, course)
 */
router.get('/:conversationId/contact', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const result = await db.query(
      `SELECT ct.id as contact_id, ct.display_name, ct.external_id, ct.profile, ct.lead_status,
              c.lead_stage_id,
              ls.name AS lead_stage_name,
              ls.color AS lead_stage_color,
              ls.is_closed AS lead_stage_is_closed
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       LEFT JOIN lead_stages ls ON ls.id = c.lead_stage_id
       WHERE c.id = $1`,
      [conversationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const row = result.rows[0];
    const profile = row.profile || {};
    
    // Fetch tags/labels for this contact
    const labelsRes = await db.query(
      `SELECT cl.name 
       FROM contact_label_maps clm
       JOIN contact_labels cl ON cl.id = clm.label_id
       WHERE clm.contact_id = $1`,
      [row.contact_id]
    );
    const tags = labelsRes.rows.map(r => r.name);

    res.json({
      contactId: row.contact_id,
      name: row.display_name,
      number: row.external_id,
      course: profile.course || '',
      preferredLanguage: profile.preferred_language || '',
      blocked: profile.blocked === true,
      leadStage: row.lead_stage_id
        ? {
          id: row.lead_stage_id,
          name: row.lead_stage_name,
          color: row.lead_stage_color,
          isClosed: row.lead_stage_is_closed === true,
        }
        : null,
      leadStatus: row.lead_status || 'new',
      tags: tags
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/conversations/:conversationId/lead-stage
 * Updates the lead stage for this conversation.
 */
router.put('/:conversationId/lead-stage', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const teamId = resolveTeamId(req);
    if (!teamId) {
      return res.status(400).json({ error: 'teamId required' });
    }

    const stageId = Object.prototype.hasOwnProperty.call(req.body || {}, 'stageId')
      ? req.body.stageId
      : null;

    if (stageId) {
      const stageRes = await db.query(
        `SELECT id, name, color, is_closed
         FROM lead_stages
         WHERE id = $1 AND team_id = $2`,
        [stageId, teamId]
      );
      if (stageRes.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid lead stage' });
      }

      const upd = await db.query(
        `UPDATE conversations
         SET lead_stage_id = $1
         WHERE id = $2
         RETURNING id, contact_id`,
        [stageId, conversationId]
      );
      if (upd.rowCount === 0) return res.status(404).json({ error: 'Conversation not found' });
      
      const contactId = upd.rows[0].contact_id;
      // Sync text stage back to contacts table for Registry visibility
      await db.query(`UPDATE contacts SET lead_stage = $1 WHERE id = $2`, [stageRes.rows[0].name, contactId]);
      try {
        const { runStageWorkflows } = require('../services/workflows');
        const phoneRes = await db.query('SELECT contacts.external_id FROM conversations JOIN contacts ON contacts.id = conversations.contact_id WHERE conversations.id = $1', [conversationId]);
        const phoneNumber = phoneRes.rows[0]?.external_id;
        // Run sequence in background to prevent API hang
        if (phoneNumber) runStageWorkflows(stageId, phoneNumber).catch(e => console.error('[lead-stage] Drip error:', e.message));
      } catch (e) {
        console.error('[lead-stage] Failed to trigger stage workflows:', e.message);
      }
      return res.json({
        conversationId,
        leadStage: {
          id: stageRes.rows[0].id,
          name: stageRes.rows[0].name,
          color: stageRes.rows[0].color,
          isClosed: stageRes.rows[0].is_closed === true,
        },
      });
    }

    const upd = await db.query(
      `UPDATE conversations
       SET lead_stage_id = NULL
       WHERE id = $1
       RETURNING id`,
      [conversationId]
    );
    if (upd.rowCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ conversationId, leadStage: null });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/conversations/:conversationId/contact
 * Updates contact details (name, course, tags)
 */
router.put('/:conversationId/contact', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { name, course, tags, leadStatus } = req.body;

    const cRes = await db.query('SELECT contact_id, lead_id FROM conversations WHERE id = $1', [conversationId]);
    if (cRes.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const contactId = cRes.rows[0].contact_id;
    let leadId = cRes.rows[0].lead_id;

    console.log(`[ContactUpdate] Updating contact ${contactId} (LeadID: ${leadId}) - Name: ${name}, Course: ${course}, Tags: ${tags}`);
    
    // Update basic fields
    await db.query(
      `UPDATE contacts 
       SET display_name = $1, 
           lead_status = COALESCE($2, lead_status),
           profile = jsonb_set(COALESCE(profile, '{}'), '{course}', to_jsonb($3::text), true)
       WHERE id = $4`,
      [name, leadStatus || null, course, contactId]
    );

    // Update tags if provided
    if (Array.isArray(tags)) {
      // 1. Get existing tags for this contact
      const existingRes = await db.query(
        `SELECT cl.id, cl.name FROM contact_label_maps clm 
         JOIN contact_labels cl ON cl.id = clm.label_id 
         WHERE clm.contact_id = $1`,
        [contactId]
      );
      const existingMap = new Map(existingRes.rows.map(r => [r.name, r.id]));
      const existingNames = new Set(existingMap.keys());
      const newNames = new Set(tags);

      // 2. Find tags to add
      const toAdd = [...newNames].filter(x => !existingNames.has(x));
      for (const tagName of toAdd) {
        // Find label ID by name
        let labelRes = await db.query('SELECT id FROM contact_labels WHERE name = $1', [tagName]);
        let labelId;
        if (labelRes.rows.length > 0) {
          labelId = labelRes.rows[0].id;
        } else {
          // Should be created via API but handle fallback just in case or skip
          continue; 
        }
        await db.query(
          `INSERT INTO contact_label_maps (contact_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [contactId, labelId]
        );
      }

      // 3. Find tags to remove
      const toRemove = [...existingNames].filter(x => !newNames.has(x));
      for (const tagName of toRemove) {
        const labelId = existingMap.get(tagName);
        if (labelId) {
          await db.query(
            `DELETE FROM contact_label_maps WHERE contact_id = $1 AND label_id = $2`,
            [contactId, labelId]
          );
        }
      }
    }

    // Lead syncing logic...
    let effectiveLeadId = leadId;
    if (!effectiveLeadId && req.body.leadId) {
      effectiveLeadId = req.body.leadId;
      // Optionally update the conversation with this leadId?
      // await db.query('UPDATE conversations SET lead_id = $1 WHERE id = $2', [effectiveLeadId, conversationId]);
    }

    if (!effectiveLeadId) {
      // Fallback: Check contact profile for leadId
      const ctRes = await db.query('SELECT profile FROM contacts WHERE id = $1', [contactId]);
      if (ctRes.rows.length > 0 && ctRes.rows[0].profile && ctRes.rows[0].profile.leadId) {
        effectiveLeadId = ctRes.rows[0].profile.leadId;
      }
    }



    await db.query(
      `UPDATE contacts 
       SET display_name = $1, 
           profile = jsonb_set(COALESCE(profile, '{}'), '{course}', to_jsonb($2::text), true)
       WHERE id = $3`,
      [name, course, contactId]
    );



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
router.post('/claim', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
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
router.post('/reassign', auth.requireRole('admin', 'super_admin', 'quality_manager'), async (req, res, next) => {
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

router.post('/release', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
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

router.post('/:conversationId/pin', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
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

router.post('/:conversationId/status', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
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

router.post('/:conversationId/block', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
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

router.post('/:conversationId/unblock', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
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

router.delete('/:conversationId', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
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

router.put('/:conversationId/ai-status', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    const upd = await db.query(
      `UPDATE conversations SET is_ai_active = $1 WHERE id = $2 RETURNING id, is_ai_active`,
      [is_active, conversationId]
    );

    if (upd.rowCount === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, is_ai_active: upd.rows[0].is_ai_active });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
