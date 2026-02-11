'use strict';
const express = require('express');
const router = express.Router();
const svc = require('../services/workflows');
const auth = require('../middlewares/auth');

// List workflows
router.get('/', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const workflows = await svc.listWorkflows();
    res.json(workflows);
  } catch (err) {
    next(err);
  }
});

// Create workflow
router.post('/', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const workflow = await svc.createWorkflow(req.body);
    res.status(201).json(workflow);
  } catch (err) {
    next(err);
  }
});

// Get workflow
router.get('/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const workflow = await svc.getWorkflow(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// Update workflow
router.put('/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const workflow = await svc.updateWorkflow(req.params.id, req.body);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// Delete workflow
router.delete('/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    await svc.deleteWorkflow(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Run workflow (Manual Trigger)
router.post('/:id/run', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }
    const result = await svc.runWorkflow(req.params.id, phoneNumber);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
