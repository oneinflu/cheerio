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
    const result = await db.query('SELECT id, name, email, role, active, created_at FROM users ORDER BY name ASC');
    
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
        createdAt: u.created_at
      };
    });

    res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
