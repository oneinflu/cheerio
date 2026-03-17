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

    // 1. Try Local authentication first
    const bcrypt = require('bcrypt');
    const localUserRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (localUserRes.rows.length > 0) {
        const localUser = localUserRes.rows[0];
        if (localUser.password_hash) {
            const isValid = await bcrypt.compare(password, localUser.password_hash);
            if (isValid) {
                // Determine team IDs
                const teamRes = await db.query('SELECT team_id FROM team_members WHERE user_id = $1', [localUser.id]);
                const teamIds = teamRes.rows.map(r => r.team_id);
                
                const accessToken = jwt.sign({
                    userId: localUser.id,
                    role: localUser.role,
                    email: localUser.email,
                    teamIds: teamIds
                }, JWT_SECRET, { expiresIn: '7d' });

                return res.json({
                    success: true,
                    data: {
                        accessToken: accessToken,
                        user: {
                            _id: localUser.id,
                            id: localUser.id,
                            firstname: localUser.name.split(' ')[0],
                            lastname: localUser.name.split(' ').slice(1).join(' '),
                            name: localUser.name,
                            email: localUser.email,
                            role: localUser.role,
                            teamIds: teamIds,
                            status: localUser.active ? 'available' : 'logout',
                            attributes: localUser.attributes || {}
                        }
                    }
                });
            }
        }
    }

    // 2. Fallback to external API
    const response = await axios.post('https://api.starforze.com/api/team-auth/login', {
      email,
      password
    });

    if (response.data && response.data.success) {
      const { accessToken, user } = response.data.data;
      
      // Map roles
      const roleMap = {
        'super_admin': 'super_admin',
        'admin': 'admin',
        'team_lead': 'supervisor',
        'agent': 'agent',
        'quality_manager': 'quality_manager'
      };
      const localRole = roleMap[user.role] || user.role || 'agent';
      const userId = user._id || user.id;

      // Upsert user to local DB
      await db.query(`
        INSERT INTO users (id, email, name, role, active, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          active = EXCLUDED.active
      `, [userId, user.email, `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Unknown', localRole, user.status === 'available']);

      res.json({
        success: true,
        data: {
          accessToken: accessToken,
          user: {
            ...user, // Retain original fields so frontend maps it correctly
            id: userId,
            _id: userId,
            role: localRole
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

router.post('/onboarding', auth.requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Update onboarding_completed flag in attributes jsonb
    await db.query(`
      UPDATE users 
      SET attributes = COALESCE(attributes, '{}'::jsonb) || '{"onboarding_completed": true}'::jsonb
      WHERE id = $1
    `, [userId]);

    res.json({ success: true, message: 'Onboarding marked as completed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
