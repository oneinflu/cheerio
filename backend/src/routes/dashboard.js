'use strict';

const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboard');

// GET /api/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const teamId = req.query.teamId;
    const data = await dashboardService.getDashboard(teamId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
