'use strict';
const db = require('../../db');
const { getIO } = require('../realtime/io');

function ensureStaffRole(actorRole) {
  if (!['admin', 'agent', 'supervisor'].includes(actorRole)) {
    const err = new Error('Staff role required');
    err.status = 403;
    err.expose = true;
    throw err;
  }
}

function ensureAdmin(actorRole) {
  if (actorRole !== 'admin') {
    const err = new Error('Admin role required');
    err.status = 403;
    err.expose = true;
    throw err;
  }
}

async function listNotes(conversationId, actorRole) {
  ensureStaffRole(actorRole);
  const res = await db.query(
    `
    SELECT id, conversation_id, author_user_id, body, created_at
    FROM staff_notes
    WHERE conversation_id = $1
    ORDER BY created_at DESC
    `,
    [conversationId]
  );
  return res.rows;
}

async function createNote(conversationId, authorUserId, body, actorRole) {
  ensureStaffRole(actorRole);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `
      INSERT INTO staff_notes (id, conversation_id, author_user_id, body, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NOW())
      RETURNING id
      `,
      [conversationId, authorUserId, body]
    );
    const noteId = ins.rows[0].id;
    await client.query(
      `
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (gen_random_uuid(), $1, 'staff_note.create', 'staff_note', $2, $3::jsonb, NOW())
      `,
      [authorUserId, noteId, JSON.stringify({ conversationId })]
    );
    await client.query('COMMIT');
    const io = getIO();
    if (io) io.to(`conversation:${conversationId}`).emit('staff_note:new', { conversationId, noteId });
    return { noteId };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function updateNote(noteId, newBody, actorRole, actorUserId) {
  ensureAdmin(actorRole);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const prev = await client.query(
      `SELECT conversation_id, body FROM staff_notes WHERE id = $1`,
      [noteId]
    );
    if (prev.rowCount === 0) {
      const err = new Error('Note not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }
    const conversationId = prev.rows[0].conversation_id;
    const oldBody = prev.rows[0].body;
    await client.query(
      `UPDATE staff_notes SET body = $1 WHERE id = $2`,
      [newBody, noteId]
    );
    await client.query(
      `
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (gen_random_uuid(), $1, 'staff_note.update', 'staff_note', $2, $3::jsonb, NOW())
      `,
      [actorUserId, noteId, JSON.stringify({ conversationId, oldBody, newBody })]
    );
    await client.query('COMMIT');
    const io = getIO();
    if (io) io.to(`conversation:${conversationId}`).emit('staff_note:updated', { conversationId, noteId });
    return { noteId };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function deleteNote(noteId, actorRole, actorUserId) {
  ensureAdmin(actorRole);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const prev = await client.query(
      `SELECT conversation_id, body FROM staff_notes WHERE id = $1`,
      [noteId]
    );
    if (prev.rowCount === 0) {
      const err = new Error('Note not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }
    const conversationId = prev.rows[0].conversation_id;
    const oldBody = prev.rows[0].body;
    await client.query(`DELETE FROM staff_notes WHERE id = $1`, [noteId]);
    await client.query(
      `
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (gen_random_uuid(), $1, 'staff_note.delete', 'staff_note', $2, $3::jsonb, NOW())
      `,
      [actorUserId, noteId, JSON.stringify({ conversationId, oldBody })]
    );
    await client.query('COMMIT');
    const io = getIO();
    if (io) io.to(`conversation:${conversationId}`).emit('staff_note:deleted', { conversationId, noteId });
    return { noteId };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listNotes,
  createNote,
  updateNote,
  deleteNote,
};

