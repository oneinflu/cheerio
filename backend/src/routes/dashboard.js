'use strict';

const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboard');

// GET /api/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const teamId = req.query.teamId; // Optional: support filtering by team

    const [stats, volume, agents] = await Promise.all([
      dashboardService.getStats(teamId),
      dashboardService.getVolume(teamId),
      dashboardService.getAgents(teamId)
    ]);

    // Mock KPIs for now as they require complex calculation (SLA, Median Response)
    const kpi = {
      medianFirstReply: '2m 14s',
      slaCompliance: '96%'
    };

    res.json({
      stats,
      volume,
      agents,
      kpi
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
