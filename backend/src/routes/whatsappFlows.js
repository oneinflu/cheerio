'use strict';

const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const db = require('../../db');
const auth = require('../middlewares/auth');

const BASE_URL = 'https://graph.facebook.com/v21.0';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getToken() {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error('WHATSAPP_TOKEN env variable is not set');
  return token;
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${getToken()}`, ...extra };
}

function wrapMetaError(err) {
  if (err.response) {
    const data = err.response.data || {};
    const metaErr = new Error((data.error && data.error.message) || 'Meta API error');
    metaErr.status = err.response.status;
    metaErr.response = data;
    throw metaErr;
  }
  throw err;
}

function sendFlowMetaError(res, err, fallbackMessage) {
  const status = err && err.status ? err.status : 500;
  const payload = {
    error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
    message: err && err.message ? err.message : fallbackMessage,
  };

  let validationErrors = null;
  const resp = err && err.response ? err.response : null;
  if (resp && Array.isArray(resp.validation_errors)) validationErrors = resp.validation_errors;
  if (!validationErrors && resp && resp.error && resp.error.error_data) {
    const ed = resp.error.error_data;
    validationErrors = ed.flow_validation_errors || ed.validation_errors || null;
  }
  if (validationErrors) payload.details = { validation_errors: validationErrors };
  return res.status(status).json(payload);
}

// ─────────────────────────────────────────────
// Meta API functions
// ─────────────────────────────────────────────

async function metaGetFlows(wabaId) {
  try {
    const res = await axios.get(`${BASE_URL}/${wabaId}/flows`, {
      headers: authHeaders(),
      params: { fields: 'id,name,status,categories,validation_errors,json_version,endpoint_uri' },
    });
    return res.data.data || [];
  } catch (err) { wrapMetaError(err); }
}

// STEP 1 — create shell: only name + categories accepted here by Meta
async function metaCreateFlowShell(wabaId, { name, categories, cloneFlowId }) {
  const payload = { name, categories: Array.isArray(categories) ? categories : ['OTHER'] };
  if (cloneFlowId) payload.clone_flow_id = cloneFlowId;
  try {
    const res = await axios.post(`${BASE_URL}/${wabaId}/flows`, payload, {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    return res.data; // { id, success }
  } catch (err) { wrapMetaError(err); }
}

// STEP 2 — upload flow JSON as multipart/form-data asset
async function metaUploadFlowJson(flowId, flowJson) {
  const form = new FormData();
  form.append('name', 'flow.json');
  form.append('asset_type', 'FLOW_JSON');
  form.append('file', Buffer.from(JSON.stringify(flowJson, null, 2)), {
    filename: 'flow.json',
    contentType: 'application/json',
  });
  try {
    const res = await axios.post(`${BASE_URL}/${flowId}/assets`, form, {
      headers: { ...authHeaders(), ...form.getHeaders() },
    });
    return res.data; // { success, validation_errors }
  } catch (err) { wrapMetaError(err); }
}

// STEP 3 — publish (irreversible — published flows cannot be edited, only cloned)
async function metaPublishFlow(flowId) {
  try {
    const res = await axios.post(`${BASE_URL}/${flowId}/publish`, {}, {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    return res.data;
  } catch (err) { wrapMetaError(err); }
}

async function metaUpdateMetadata(flowId, payload) {
  try {
    const res = await axios.post(`${BASE_URL}/${flowId}`, payload, {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    return res.data;
  } catch (err) { wrapMetaError(err); }
}

async function metaDeleteFlow(flowId) {
  try {
    const res = await axios.delete(`${BASE_URL}/${flowId}`, { headers: authHeaders() });
    return res.data;
  } catch (err) { wrapMetaError(err); }
}

// Composite: shell → upload JSON → (optional) publish
async function metaCreateFlow({ name, categories, flowJson, publish = false, cloneFlowId, endpointUri }) {
  const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!WABA_ID) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID not configured');

  const created = await metaCreateFlowShell(WABA_ID, { name, categories, cloneFlowId });
  const flowId = created.id;
  if (!flowId) throw Object.assign(new Error('Meta did not return a flow id'), { status: 502 });

  if (flowJson) {
    const upload = await metaUploadFlowJson(flowId, flowJson);
    if (upload && upload.validation_errors && upload.validation_errors.length) {
      throw Object.assign(new Error('Flow JSON has validation errors'), {
        status: 422,
        response: { validation_errors: upload.validation_errors },
      });
    }
  }

  if (endpointUri) await metaUpdateMetadata(flowId, { endpoint_uri: endpointUri });

  let publishResult = null;
  if (publish) publishResult = await metaPublishFlow(flowId);

  return { id: flowId, published: !!(publishResult && publishResult.success) };
}

// Composite update: re-upload JSON + update metadata
async function metaUpdateFlow(flowId, { name, categories, flowJson, endpointUri }) {
  if (flowJson) {
    const upload = await metaUploadFlowJson(flowId, flowJson);
    if (upload && upload.validation_errors && upload.validation_errors.length) {
      throw Object.assign(new Error('Flow JSON has validation errors'), {
        status: 422,
        response: { validation_errors: upload.validation_errors },
      });
    }
  }
  const metadataPayload = {};
  if (name !== undefined) metadataPayload.name = name;
  if (categories !== undefined) metadataPayload.categories = categories;
  if (endpointUri !== undefined) metadataPayload.endpoint_uri = endpointUri;
  if (Object.keys(metadataPayload).length > 0) await metaUpdateMetadata(flowId, metadataPayload);
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

// SYNC
router.post('/whatsapp/flows/sync', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    if (!WABA_ID) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID not configured');
    const remoteFlows = await metaGetFlows(WABA_ID);
    const upserted = [];
    for (const flow of remoteFlows) {
      const result = await db.query(
        `INSERT INTO whatsapp_flows (flow_id, name, status, categories, flow_json)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         ON CONFLICT (flow_id) DO UPDATE SET
           name = EXCLUDED.name, status = EXCLUDED.status,
           categories = EXCLUDED.categories, updated_at = NOW()
         RETURNING id, flow_id, name, status, categories, created_at, updated_at`,
        [flow.id, flow.name, flow.status, flow.categories || []]
      );
      upserted.push(result.rows[0]);
    }
    res.json({ count: upserted.length, data: upserted });
  } catch (err) { next(err); }
});

// LIST
router.get('/whatsapp/flows', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, flow_id, name, status, description, categories, flow_json, created_at, updated_at
       FROM whatsapp_flows ORDER BY created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});

// CREATE
router.post('/whatsapp/flows', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { name, description, categories, flow_json, publish, endpoint_uri, clone_flow_id } = req.body || {};

    if (!name) return res.status(400).json({ error: 'Bad Request', message: 'name is required' });
    if (!flow_json || typeof flow_json !== 'object') return res.status(400).json({ error: 'Bad Request', message: 'flow_json (object) is required' });
    if (!categories || !Array.isArray(categories) || !categories.length) return res.status(400).json({ error: 'Bad Request', message: 'categories (array) is required' });

    const endpointUri = endpoint_uri || (flow_json.meta && flow_json.meta.endpoint_uri);

    let remoteFlowId = null;
    let remoteStatus = 'DRAFT';

    try {
      const created = await metaCreateFlow({
        name, categories, flowJson: flow_json,
        publish: publish === true,
        cloneFlowId: clone_flow_id,
        endpointUri,
      });
      remoteFlowId = created.id;
      if (created.published) remoteStatus = 'PUBLISHED';
    } catch (err) {
      return sendFlowMetaError(res, err, 'Failed to create WhatsApp Flow on Meta');
    }

    const result = await db.query(
      `INSERT INTO whatsapp_flows (flow_id, name, description, status, categories, flow_json)
       VALUES ($1, $2, $3, $4, COALESCE($5, ARRAY[]::text[]), $6::jsonb)
       RETURNING id, flow_id, name, description, status, categories, flow_json, created_at, updated_at`,
      [remoteFlowId, name, description || null, remoteStatus, categories, JSON.stringify(flow_json)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// UPDATE
router.put('/whatsapp/flows/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, categories, flow_json, publish, endpoint_uri } = req.body || {};

    const existingResult = await db.query(
      `SELECT id, flow_id, name, description, status, categories, flow_json FROM whatsapp_flows WHERE id = $1`,
      [id]
    );
    if (existingResult.rowCount === 0) return res.status(404).json({ error: 'Not Found', message: 'Flow not found' });

    const existing = existingResult.rows[0];
    const nextName       = name       !== undefined ? name       : existing.name;
    const nextCategories = categories !== undefined ? categories : existing.categories;
    const nextFlowJson   = flow_json  !== undefined ? flow_json  : existing.flow_json;
    const endpointUri    = endpoint_uri || (nextFlowJson && nextFlowJson.meta && nextFlowJson.meta.endpoint_uri);

    let remoteFlowId = existing.flow_id;
    let remoteStatus = existing.status;

    try {
      if (!remoteFlowId) {
        const created = await metaCreateFlow({
          name: nextName, categories: nextCategories, flowJson: nextFlowJson,
          publish: publish === true, endpointUri,
        });
        remoteFlowId = created.id;
        if (created.published) remoteStatus = 'PUBLISHED';
      } else {
        await metaUpdateFlow(remoteFlowId, {
          name: nextName, categories: nextCategories,
          flowJson: flow_json !== undefined ? nextFlowJson : undefined,
          endpointUri,
        });
        if (publish === true) {
          await metaPublishFlow(remoteFlowId);
          remoteStatus = 'PUBLISHED';
        }
      }
    } catch (err) {
      return sendFlowMetaError(res, err, 'Failed to update WhatsApp Flow on Meta');
    }

    const result = await db.query(
      `UPDATE whatsapp_flows SET
         flow_id = COALESCE($1, flow_id), name = COALESCE($2, name),
         description = COALESCE($3, description), status = COALESCE($4, status),
         categories = COALESCE($5, categories), flow_json = COALESCE($6::jsonb, flow_json),
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, flow_id, name, description, status, categories, flow_json, created_at, updated_at`,
      [
        remoteFlowId || null,
        name !== undefined ? name : null,
        description !== undefined ? description : null,
        remoteStatus || null,
        categories !== undefined ? categories : null,
        flow_json !== undefined ? JSON.stringify(nextFlowJson) : null,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// PUBLISH explicitly
router.post('/whatsapp/flows/:id/publish', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingResult = await db.query(
      `SELECT id, flow_id, status FROM whatsapp_flows WHERE id = $1`, [id]
    );
    if (existingResult.rowCount === 0) return res.status(404).json({ error: 'Not Found', message: 'Flow not found' });
    const existing = existingResult.rows[0];
    if (!existing.flow_id) return res.status(400).json({ error: 'Bad Request', message: 'Flow has no remote Meta flow_id yet' });
    if (existing.status === 'PUBLISHED') return res.status(400).json({ error: 'Bad Request', message: 'Flow is already published. Clone it to make changes.' });

    try {
      await metaPublishFlow(existing.flow_id);
    } catch (err) {
      return sendFlowMetaError(res, err, 'Failed to publish WhatsApp Flow on Meta');
    }

    const result = await db.query(
      `UPDATE whatsapp_flows SET status = 'PUBLISHED', updated_at = NOW()
       WHERE id = $1
       RETURNING id, flow_id, name, description, status, categories, flow_json, created_at, updated_at`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE
router.delete('/whatsapp/flows/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingResult = await db.query(
      `SELECT id, flow_id, status FROM whatsapp_flows WHERE id = $1`, [id]
    );
    if (existingResult.rowCount === 0) return res.status(404).json({ error: 'Not Found', message: 'Flow not found' });
    const existing = existingResult.rows[0];

    if (existing.flow_id && existing.status !== 'PUBLISHED') {
      try {
        await metaDeleteFlow(existing.flow_id);
      } catch (err) {
        console.error(`[WhatsApp] Failed to delete flow ${existing.flow_id} from Meta:`, err.message);
      }
    }

    await db.query(`DELETE FROM whatsapp_flows WHERE id = $1`, [id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;