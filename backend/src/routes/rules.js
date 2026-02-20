'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const svc = require('../services/rules');

router.get('/rules', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const rules = await svc.listRules();
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

router.post('/rules', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const rule = await svc.createRule(req.body);
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

router.put('/rules/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const rule = await svc.updateRule(req.params.id, req.body);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

router.delete('/rules/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    await svc.deleteRule(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

