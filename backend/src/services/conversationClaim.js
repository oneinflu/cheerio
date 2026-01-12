'use strict';
/**
 * src/services/conversationClaim.js
 *
 * Purpose:
 * - Implements conversation claiming and reassignment with strong consistency.
 * - Guarantees that only one active assignee exists per conversation.
 * - Uses PostgreSQL transactions and row-level locks to prevent race conditions.
 *
 * Locking algorithm (explained in simple terms):
 * 1) Start a transaction to group all changes atomically.
 * 2) Lock the target conversation row using `SELECT ... FOR UPDATE`.
 *    - This makes concurrent claim/reassign operations wait for each other.
 * 3) Read the current active assignment with `SELECT ... FOR UPDATE`.
 *    - If an active assignment exists, we hold a lock on that row so it cannot change
 *      while we decide how to proceed.
 * 4) For a normal claim:
 *    - If there is no active assignment, insert one.
 *    - If there is an active assignment for the same user, treat as success (idempotent).
 *    - If there is an active assignment for a different user, reject.
 * 5) For an admin reassignment:
 *    - If an active assignment exists, mark it released.
 *    - Insert a new active assignment for the chosen user.
 * 6) Rely on the DB unique partial index `(conversation_id) WHERE released_at IS NULL`
 *    to enforce the “at most one active assignee” rule even under concurrency.
 *    - If two concurrent inserts race, one will succeed and the other receives a unique
 *      constraint violation; we convert that to a user-friendly error.
 * 7) Commit the transaction. If any step fails, rollback to avoid partial state.
 */

const db = require('../../db');
const { getIO } = require('../realtime/io');

async function claimConversation(conversationId, teamId, userId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Step 1/2: Lock the conversation row to serialize concurrent claim attempts.
    const conv = await client.query(
      `SELECT id FROM conversations WHERE id = $1 FOR UPDATE`,
      [conversationId]
    );
    if (conv.rowCount === 0) {
      const err = new Error('Conversation not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }

    // Step 3: Lock the active assignment row (if any).
    const active = await client.query(
      `
      SELECT id, assignee_user_id
      FROM conversation_assignments
      WHERE conversation_id = $1 AND released_at IS NULL
      FOR UPDATE
      `,
      [conversationId]
    );

    if (active.rowCount > 0) {
      const currentAssignee = active.rows[0].assignee_user_id;
      if (currentAssignee === userId) {
        // Idempotent success: user already holds the claim.
        // Audit idempotent claim
        await client.query(
          `
          INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
          VALUES (gen_random_uuid(), $1, 'conversation.claim', 'conversation', $2, $3::jsonb, NOW())
          `,
          [userId, conversationId, JSON.stringify({ teamId, assigneeUserId: userId, idempotent: true })]
        );
        await client.query('COMMIT');
        const io = getIO();
        if (io) io.to(`conversation:${conversationId}`).emit('assignment:claimed', { conversationId, userId });
        return { conversationId, assigneeUserId: userId, status: 'already_assigned' };
      }
      // Another agent holds the claim; normal claim should fail.
      const err = new Error('Conversation already claimed by another agent');
      err.status = 409;
      err.expose = true;
      throw err;
    }

    // Step 4: No active assignment exists; insert a new one.
    try {
      const ins = await client.query(
        `
        INSERT INTO conversation_assignments (id, conversation_id, team_id, assignee_user_id, claimed_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW())
        RETURNING id
        `,
        [conversationId, teamId, userId]
      );

      await client.query(
        `
        INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
        VALUES (gen_random_uuid(), $1, 'conversation.claim', 'conversation', $2, $3::jsonb, NOW())
        `,
        [userId, conversationId, JSON.stringify({ teamId, assigneeUserId: userId, assignmentId: ins.rows[0].id })]
      );

      await client.query('COMMIT');
      const io = getIO();
      if (io) io.to(`conversation:${conversationId}`).emit('assignment:claimed', { conversationId, userId });
      return { conversationId, assigneeUserId: userId, assignmentId: ins.rows[0].id, status: 'assigned' };
    } catch (e) {
      // Step 6: Unique violation indicates a concurrent insert won.
      if (String(e.message || '').includes('duplicate key')) {
        const err = new Error('Conversation was claimed concurrently; try again');
        err.status = 409;
        err.expose = true;
        throw err;
      }
      throw e;
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function reassignConversation(conversationId, teamId, newAssigneeUserId, actorRole, actorUserId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Only admins may force reassignment.
    if (actorRole !== 'admin') {
      const err = new Error('Admin role required for reassignment');
      err.status = 403;
      err.expose = true;
      throw err;
    }

    // Lock conversation to serialize with other claim/reassign operations.
    const conv = await client.query(
      `SELECT id FROM conversations WHERE id = $1 FOR UPDATE`,
      [conversationId]
    );
    if (conv.rowCount === 0) {
      const err = new Error('Conversation not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }

    // Lock current active assignment if present, then release it.
    const active = await client.query(
      `
      SELECT id, assignee_user_id
      FROM conversation_assignments
      WHERE conversation_id = $1 AND released_at IS NULL
      FOR UPDATE
      `,
      [conversationId]
    );

    if (active.rowCount > 0) {
      const assignmentId = active.rows[0].id;
      await client.query(
        `
        UPDATE conversation_assignments
        SET released_at = NOW()
        WHERE id = $1
        `,
        [assignmentId]
      );
    }

    // Insert new active assignment for the chosen user.
    try {
      const ins = await client.query(
        `
        INSERT INTO conversation_assignments (id, conversation_id, team_id, assignee_user_id, claimed_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW())
        RETURNING id
        `,
        [conversationId, teamId, newAssigneeUserId]
      );

      await client.query(
        `
        INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
        VALUES (gen_random_uuid(), $1, 'conversation.reassign', 'conversation', $2, $3::jsonb, NOW())
        `,
        [actorUserId, conversationId, JSON.stringify({ teamId, newAssigneeUserId, assignmentId: ins.rows[0].id })]
      );

      await client.query('COMMIT');
      const io = getIO();
      if (io) io.to(`conversation:${conversationId}`).emit('assignment:reassigned', {
        conversationId,
        assigneeUserId: newAssigneeUserId,
        assignmentId: ins.rows[0].id,
      });
      return { conversationId, assigneeUserId: newAssigneeUserId, assignmentId: ins.rows[0].id, status: 'reassigned' };
    } catch (e) {
      // Handle rare race: another admin inserted concurrently.
      if (String(e.message || '').includes('duplicate key')) {
        const err = new Error('Concurrent reassignment detected; try again');
        err.status = 409;
        err.expose = true;
        throw err;
      }
      throw e;
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function releaseConversation(conversationId, actorRole, actorUserId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const conv = await client.query(
      `SELECT id FROM conversations WHERE id = $1 FOR UPDATE`,
      [conversationId]
    );
    if (conv.rowCount === 0) {
      const err = new Error('Conversation not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }

    const active = await client.query(
      `
      SELECT id, team_id, assignee_user_id
      FROM conversation_assignments
      WHERE conversation_id = $1 AND released_at IS NULL
      FOR UPDATE
      `,
      [conversationId]
    );

    if (active.rowCount === 0) {
      await client.query('COMMIT');
      const io = getIO();
      if (io) io.to(`conversation:${conversationId}`).emit('assignment:released', { conversationId });
      return { conversationId, status: 'already_unassigned' };
    }

    const assignment = active.rows[0];
    if (actorRole !== 'admin' && assignment.assignee_user_id !== actorUserId) {
      const err = new Error('Forbidden');
      err.status = 403;
      err.expose = true;
      throw err;
    }

    await client.query(
      `
      UPDATE conversation_assignments
      SET released_at = NOW()
      WHERE id = $1
      `,
      [assignment.id]
    );

    await client.query(
      `
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (gen_random_uuid(), $1, 'conversation.release', 'conversation', $2, $3::jsonb, NOW())
      `,
      [
        actorUserId,
        conversationId,
        JSON.stringify({
          teamId: assignment.team_id,
          previousAssigneeUserId: assignment.assignee_user_id,
          assignmentId: assignment.id,
        }),
      ]
    );

    await client.query('COMMIT');
    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('assignment:released', {
        conversationId,
        previousAssigneeUserId: assignment.assignee_user_id,
      });
    }
    return {
      conversationId,
      previousAssigneeUserId: assignment.assignee_user_id,
      assignmentId: assignment.id,
      status: 'released',
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  claimConversation,
  reassignConversation,
  releaseConversation,
};
