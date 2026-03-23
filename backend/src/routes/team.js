'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');

const axios = require('axios');

// GET /api/team-users/:id - Fetch user details (Local DB first, then Proxy to Starforze API)
router.get('/:id', auth.requireAuth, async (req, res, next) => {
  const { id } = req.params;
  
  // 1. Try Local DB first
  try {
    const localRes = await db.query('SELECT id, name, email, role, active, created_at FROM users WHERE id = $1', [id]);
    if (localRes.rows.length > 0) {
      const u = localRes.rows[0];
      const parts = u.name.split(' ');
      return res.json({
        data: {
          _id: u.id,
          id: u.id,
          firstname: parts[0],
          lastname: parts.slice(1).join(' '),
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.active ? 'active' : 'logout',
          createdAt: u.created_at
        }
      });
    }
  } catch (err) {
    console.warn(`[TeamAPI] Local DB lookup failed for ${id}:`, err.message);
    // Continue to external API
  }

  // 2. Fallback to External API
  try {
    console.log(`[TeamAPI] Fetching external user details for ID: ${id}`);
    
    // Call external API
    // Note: API requires authentication. Ensure STARFORZE_API_KEY is set in .env if needed.
    // For now, we try without or with a placeholder if provided.
    const apiKey = process.env.STARFORZE_API_KEY || ''; 
    const headers = {};
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (req.headers.authorization) {
        // Forward the current user's token if we don't have a master key
        headers['Authorization'] = req.headers.authorization;
    }

    const response = await axios.get(`https://api.starforze.com/api/team-users/${id}`, {
      headers,
      validateStatus: (status) => status < 500 // Resolve even if 404/401 to handle gracefully
    });

    if (response.status === 200 && response.data) {
       res.json(response.data);
    } else {
       console.warn(`[TeamAPI] External API returned ${response.status}:`, response.data);
       // Fallback or pass through error
       res.status(response.status).json(response.data);
    }
  } catch (err) {
    console.error('[TeamAPI] Error fetching external user:', err.message);
    // If it's a network error or similar
    res.status(502).json({ message: 'Failed to contact external user service', error: err.message });
  }
});

// GET /api/team-users
router.get('/', auth.requireAuth, async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, name, email, role, active, created_at, attributes FROM users ORDER BY name ASC');
    
    const users = result.rows.map(u => {
      const parts = u.name.split(' ');
      return {
        _id: u.id,
        id: u.id,
        firstname: parts[0],
        lastname: parts.slice(1).join(' '),
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.active ? 'active' : 'logout',
        createdAt: u.created_at,
        attributes: u.attributes || {}
      };
    });

    res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

// POST /api/team-users - Create local user
router.post('/', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager'), async (req, res, next) => {
  const { firstname, lastname, email, password, role, attributes } = req.body;
  if (!email || !password || !firstname || !role) {
     return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const bcrypt = require('bcrypt');
    const { randomUUID } = require('crypto');
    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const name = `${firstname} ${lastname || ''}`.trim();
    const initialAttributes = attributes || {};

    await db.query(`
      INSERT INTO users (id, email, name, role, password_hash, active, created_at, attributes)
      VALUES ($1, $2, $3, $4, $5, true, NOW(), $6)
    `, [id, email, name, role, hash, initialAttributes]);

    // Handle team_members auto join based on creator
    if (req.user && req.user.id) {
       const teamRes = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [req.user.id]);
       if (teamRes.rows.length > 0) {
          await db.query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)', [teamRes.rows[0].team_id, id]);
       }
    }

    res.status(201).json({ success: true, user: { id, email, name, role } });
  } catch(err) {
    if (err.code === '23505') {
       return res.status(409).json({ error: 'Email already exists' });
    }
    next(err);
  }
});

// PUT /api/team-users/:id - Update user details (e.g. attributes)
router.put('/:id', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager'), async (req, res, next) => {
  const { id } = req.params;
  const { attributes, password, active } = req.body;
  
  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (attributes !== undefined) {
      updates.push(`attributes = $${idx++}`);
      values.push(attributes);
    }
    if (active !== undefined) {
      updates.push(`active = $${idx++}`);
      values.push(active === true);
    }
    if (password) {
      const bcrypt = require('bcrypt');
      updates.push(`password_hash = $${idx++}`);
      values.push(await bcrypt.hash(password, 10));
    }

    if (updates.length > 0) {
      values.push(id);
      const result = await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, attributes, active`,
        values
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ success: true, data: result.rows[0] });
    }
    
    res.status(400).json({ error: 'No updateable fields provided' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/team-users/:id - Delete local user
router.delete('/:id', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager'), async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Only allow deletion of local users (those with a password_hash)
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 AND password_hash IS NOT NULL RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Local user not found or not a native account' });
    }

    res.json({ success: true, message: 'Local user deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
