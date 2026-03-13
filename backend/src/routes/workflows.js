'use strict';
const express = require('express');
const router = express.Router();
const svc = require('../services/workflows');
const auth = require('../middlewares/auth');
const db = require('../../db');

async function resolveTeamId(req) {
  // Do not rely on custom headers; derive or fallback
  if (req.query && req.query.teamId) return req.query.teamId;
  if (req.user && Array.isArray(req.user.teamIds) && req.user.teamIds.length > 0) {
    return req.user.teamIds[0];
  }
  if (req.user && req.user.id) {
    try {
      const res = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [req.user.id]);
      const t = res.rows[0]?.team_id;
      if (t) return t;
    } catch (e) {}
  }
  try {
    const anyTeam = await db.query('SELECT id FROM teams ORDER BY created_at ASC LIMIT 1');
    let t = anyTeam.rows[0]?.id;
    if (!t) {
      t = 'default';
      await db.query('INSERT INTO teams (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [t, 'Default Team']);
    }
    return t;
  } catch (e) {
    return 'default';
  }
}

router.post('/ai/generate', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
  try {
    const { description } = req.body;
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'description is required' });
    }
    const graph = await svc.generateWorkflowFromDescription(description);
    res.json(graph);
  } catch (err) {
    next(err);
  }
});

// List workflows
router.get('/', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
  try {
    const workflows = await svc.listWorkflows();
    res.json(workflows);
  } catch (err) {
    next(err);
  }
});

// Create workflow
router.post('/', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
  try {
    const { stageId, ...workflowData } = req.body;
    const workflow = await svc.createWorkflow(workflowData);

    if (stageId) {
      const posRes = await db.query(
        `SELECT COALESCE(MAX(position), 0) AS max_pos FROM lead_stage_workflows WHERE stage_id = $1`,
        [stageId]
      );
      const nextPos = Number(posRes.rows[0].max_pos || 0) + 1;
      await db.query(
        `INSERT INTO lead_stage_workflows (stage_id, workflow_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (stage_id, workflow_id) DO UPDATE SET position = EXCLUDED.position`,
        [stageId, workflow.id, nextPos]
      );
    }
    
    res.status(201).json(workflow);
  } catch (err) {
    next(err);
  }
});

router.get('/kanban', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const stagesRes = await db.query(
      `SELECT id, name, color, position, is_closed
       FROM lead_stages
       WHERE team_id = $1
       ORDER BY position ASC, created_at ASC`,
      [teamId]
    );
    const stageIds = stagesRes.rows.map((s) => s.id);
    let workflowsByStage = {};
    if (stageIds.length > 0) {
      const mapRes = await db.query(
        `SELECT lsw.stage_id, lsw.workflow_id, lsw.position, w.name, w.status, w.description
         FROM lead_stage_workflows lsw
         JOIN workflows w ON w.id = lsw.workflow_id
         WHERE lsw.stage_id = ANY($1::uuid[])
         ORDER BY lsw.stage_id, lsw.position ASC, w.created_at ASC`,
        [stageIds]
      );
      workflowsByStage = mapRes.rows.reduce((acc, r) => {
        acc[r.stage_id] = acc[r.stage_id] || [];
        acc[r.stage_id].push({
          id: r.workflow_id,
          name: r.name,
          status: r.status,
          description: r.description,
          position: r.position,
        });
        return acc;
      }, {});
    }
    const columns = stagesRes.rows.map((s) => ({
      stage: s,
      workflows: workflowsByStage[s.id] || [],
    }));
    res.json({ columns });
  } catch (err) {
    next(err);
  }
});

router.post('/kanban/assign', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
  try {
    const { stageId, workflowId } = req.body || {};
    if (!stageId || !workflowId) return res.status(400).json({ error: 'stageId and workflowId are required' });
    const posRes = await db.query(
      `SELECT COALESCE(MAX(position), 0) AS max_pos FROM lead_stage_workflows WHERE stage_id = $1`,
      [stageId]
    );
    const nextPos = Number(posRes.rows[0].max_pos || 0) + 1;
    const result = await db.query(
      `INSERT INTO lead_stage_workflows (stage_id, workflow_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (stage_id, workflow_id) DO UPDATE SET position = EXCLUDED.position
       RETURNING stage_id, workflow_id, position`,
      [stageId, workflowId, nextPos]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/kanban/reorder', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
  try {
    const { moves } = req.body || {};
    if (!Array.isArray(moves) || moves.length === 0) {
      return res.status(400).json({ error: 'moves array required' });
    }
    await db.query('BEGIN');
    for (const mv of moves) {
      const { workflowId, toStageId, toPosition } = mv;
      if (!workflowId || !toStageId || typeof toPosition !== 'number') continue;
      
      await db.query(
        `DELETE FROM lead_stage_workflows WHERE workflow_id = $1 AND stage_id != $2`,
        [workflowId, toStageId]
      );

      await db.query(
        `INSERT INTO lead_stage_workflows (stage_id, workflow_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (stage_id, workflow_id)
         DO UPDATE SET position = EXCLUDED.position`,
        [toStageId, workflowId, toPosition]
      );
    }
    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch {}
    next(err);
  }
});

// Get workflow
router.get('/:id', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
  try {
    const workflow = await svc.getWorkflow(req.params.id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// Update workflow
router.put('/:id', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
  try {
    const workflow = await svc.updateWorkflow(req.params.id, req.body);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// Delete workflow
router.delete('/:id', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
  try {
    await svc.deleteWorkflow(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Run workflow (Manual Trigger)
router.post('/:id/run', auth.requireRole('admin', 'super_admin', 'supervisor', 'quality_manager', 'agent'), async (req, res, next) => {
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
