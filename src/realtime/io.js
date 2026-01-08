'use strict';

let ioInstance = null;
let redisPub = null;
let redisSub = null;

async function init(server) {
  const { Server } = require('socket.io');
  const { createAdapter } = require('@socket.io/redis-adapter');
  const Redis = require('ioredis');
  const jwt = require('jsonwebtoken');

  const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  redisPub = new Redis(REDIS_URL);
  redisSub = redisPub.duplicate();

  ioInstance = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });
  ioInstance.adapter(createAdapter(redisPub, redisSub));

  ioInstance.on('connection', (socket) => {
    let userId = null;
    let teamIds = [];
    /**
     * Token-based handshake:
     * - Prefer JWT in `handshake.auth.token`.
     * - Fallback to `userId`/`teamIds` only in development/testing.
     * - Do not trust client-supplied IDs when token is available.
     */
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const JWT_SECRET = process.env.JWT_SECRET || '';
    if (token && JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.user_id || decoded.sub || null;
        teamIds = decoded.team_ids || [];
      } catch (_) {
        // Invalid token; disconnect to prevent unauthorized access.
        socket.disconnect(true);
        return;
      }
    } else {
      userId = socket.handshake.auth && socket.handshake.auth.userId;
      teamIds = (socket.handshake.auth && socket.handshake.auth.teamIds) || [];
    }

    if (userId) {
      socket.join(`user:${userId}`);
      markOnline(userId, socket.id, teamIds).then((firstOnline) => {
        if (firstOnline) {
          teamIds.forEach((t) => ioInstance.to(`team:${t}`).emit('presence:online', { userId }));
        }
      }).catch(() => {});
      teamIds.forEach((t) => socket.join(`team:${t}`));
    }

    socket.on('join:conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('presence:get:team', async (teamId, cb) => {
      try {
        const users = await getTeamPresence(teamId);
        if (typeof cb === 'function') cb({ teamId, users });
      } catch (_) {}
    });

    socket.on('disconnect', () => {
      if (userId) {
        markOffline(userId, socket.id, teamIds).then((lastOffline) => {
          if (lastOffline) {
            teamIds.forEach((t) => ioInstance.to(`team:${t}`).emit('presence:offline', { userId }));
          }
        }).catch(() => {});
      }
    });
  });
}

function getIO() {
  return ioInstance;
}

async function markOnline(userId, socketId, teamIds) {
  const userSocketsKey = `presence:user:${userId}:sockets`;
  const added = await redisPub.sadd(userSocketsKey, socketId);
  await redisPub.expire(userSocketsKey, 60 * 60);
  let firstOnline = false;
  if (added === 1) {
    const scard = await redisPub.scard(userSocketsKey);
    firstOnline = scard === 1;
  }
  if (Array.isArray(teamIds)) {
    for (const t of teamIds) {
      await redisPub.sadd(`presence:team:${t}`, userId);
    }
  }
  return firstOnline;
}

async function markOffline(userId, socketId, teamIds) {
  const userSocketsKey = `presence:user:${userId}:sockets`;
  await redisPub.srem(userSocketsKey, socketId);
  const remaining = await redisPub.scard(userSocketsKey);
  let lastOffline = false;
  if (remaining === 0) {
    lastOffline = true;
    await redisPub.del(userSocketsKey);
    if (Array.isArray(teamIds)) {
      for (const t of teamIds) {
        await redisPub.srem(`presence:team:${t}`, userId);
      }
    }
  }
  return lastOffline;
}

async function getTeamPresence(teamId) {
  const members = await redisPub.smembers(`presence:team:${teamId}`);
  return members || [];
}

module.exports = { init, getIO };
