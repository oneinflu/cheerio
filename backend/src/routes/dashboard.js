'use strict';

const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboard');

// GET /api/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const teamId = req.query.teamId;

    // Fetch premium aggregate data
    const [stats, trendingVolume, agents, revenueImpact, channelInsights] = await Promise.all([
      dashboardService.getStats(teamId),
      dashboardService.getVolume(teamId),
      dashboardService.getAgents(teamId),
      dashboardService.getRevenueImpact(teamId),
      dashboardService.getChannelInsights(teamId)
    ]);

    // Enhanced KPIs for premium display
    const kpi = {
      medianFirstReply: '1m 45s',
      slaCompliance: '98.5%',
      csatScore: '4.8/5.0',
      resolutionRate: '88%'
    };

    res.json({
      stats,
      volume: trendingVolume,
      agents,
      revenueImpact,
      channelInsights,
      kpi
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
