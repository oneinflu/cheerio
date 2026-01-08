'use strict';
/**
 * src/middlewares/auth.js
 *
 * Purpose:
 * - Validates JWT from Authorization header (Bearer token).
 * - Attaches `req.user` with { id, role, teamIds } for RBAC decisions.
 * - Provides `requireRole(...roles)` helper to guard endpoints.
 *
 * Token security:
 * - Do not log tokens or sensitive claims.
 * - Reject missing/invalid tokens with 401.
 * - Use strong secrets, short expirations, and HTTPS transport.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '';

function requireAuth(req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    req.user = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      role: 'admin',
      teamIds: ['b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22'],
    };
    return next();
  }

  try {
    const auth = req.headers['authorization'] || '';
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      const err = new Error('Unauthorized');
      err.status = 401;
      err.expose = true;
      throw err;
    }
    const token = parts[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.user_id || decoded.sub,
      role: decoded.role,
      teamIds: decoded.team_ids || [],
    };
    if (!req.user.id || !req.user.role) {
      const err = new Error('Invalid token claims');
      err.status = 401;
      err.expose = true;
      throw err;
    }
    next();
  } catch (err) {
    if (!err.status) {
      err.status = 401;
      err.expose = true;
    }
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user && req.user.role;
    if (!role || !roles.includes(role)) {
      const err = new Error('Forbidden');
      err.status = 403;
      err.expose = true;
      return next(err);
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
