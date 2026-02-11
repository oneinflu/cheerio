'use strict';
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Added axios
const db = require('../../db');
const auth = require('../middlewares/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    // Call external API
    const response = await axios.post('https://api.starforze.com/api/team-auth/login', {
      email,
      password
    });

    if (response.data && response.data.success) {
      const { accessToken, user } = response.data.data;
      
      // Map roles
      const roleMap = {
        'super_admin': 'admin',
        'admin': 'admin',
        'team_lead': 'supervisor',
        'agent': 'agent'
      };
      const localRole = roleMap[user.role] || 'agent';
      const userId = user._id || user.id;

      // Upsert user to local DB
      await db.query(`
        INSERT INTO users (id, email, name, role, active, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          active = EXCLUDED.active
      `, [userId, user.email, `${user.firstname} ${user.lastname}`, localRole, user.status === 'available']);

      res.json({
        success: true,
        data: {
          accessToken: accessToken,
          user: {
            id: userId,
            name: `${user.firstname} ${user.lastname}`,
            email: user.email,
            role: localRole,
            teamIds: [] // TODO: Handle team mapping if needed
          }
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status || 401).json(err.response.data || { message: 'Login failed' });
    }
    next(err);
  }
});

router.post('/sync', auth.requireAuth, async (req, res, next) => {
  try {
    const { user } = req.body;
    if (!user || !user.id) {
      return res.status(400).json({ success: false, message: 'User data required' });
    }

    // Map roles
    const roleMap = {
      'super_admin': 'admin',
      'admin': 'admin',
      'team_lead': 'supervisor',
      'agent': 'agent'
    };
    const localRole = roleMap[user.role] || 'agent';
    const userId = user._id || user.id;

    // Upsert user to local DB
    await db.query(`
      INSERT INTO users (id, email, name, role, active, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        active = EXCLUDED.active
    `, [userId, user.email, `${user.firstname} ${user.lastname}`, localRole, user.status === 'available']);

    res.json({ success: true, message: 'User synced' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
