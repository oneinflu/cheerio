'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');
const whatsappClient = require('../integrations/meta/whatsappClient');

function sendFlowMetaError(res, err, fallbackMessage) {
  const status = err && err.status ? err.status : 500;
  const payload = {
    error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
    message: err && err.message ? err.message : fallbackMessage,
  };

  let validationErrors = null;
  const resp = err && err.response ? err.response : null;

  if (resp && Array.isArray(resp.validation_errors)) {
    validationErrors = resp.validation_errors;
  }

  const errorData = resp && resp.error && resp.error.error_data ? resp.error.error_data : null;
  if (!validationErrors && errorData) {
    if (Array.isArray(errorData.flow_validation_errors)) {
      validationErrors = errorData.flow_validation_errors;
    } else if (Array.isArray(errorData.validation_errors)) {
      validationErrors = errorData.validation_errors;
    }
  }

  if (validationErrors) {
    payload.details = { validation_errors: validationErrors };
  }

  return res.status(status).json(payload);
}

router.get('/whatsapp/flows', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const result = await db.query(
      `
      SELECT id, flow_id, name, description, categories, flow_json, created_at, updated_at
      FROM whatsapp_flows
      ORDER BY created_at DESC
      `
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/whatsapp/flows', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { name, description, categories, flow_json, flow_id, publish, endpoint_uri, clone_flow_id } = req.body || {};

    if (!name || !flow_json) {
      const err = new Error('name and flow_json are required');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    let remoteFlowId = flow_id || null;

    try {
      const endpointUri =
        endpoint_uri ||
        (flow_json &&
          typeof flow_json === 'object' &&
          flow_json.meta &&
          typeof flow_json.meta.endpoint_uri === 'string'
          ? flow_json.meta.endpoint_uri
          : undefined);

      const created = await whatsappClient.createFlow({
        name,
        categories,
        flowJson: flow_json,
        publish: typeof publish === 'boolean' ? publish : true,
        cloneFlowId: clone_flow_id,
        endpointUri,
      });

      if (created && created.id) {
        remoteFlowId = created.id;
      }
    } catch (err) {
      return sendFlowMetaError(res, err, 'Failed to create WhatsApp Flow');
    }

    const result = await db.query(
      `
      INSERT INTO whatsapp_flows (flow_id, name, description, categories, flow_json)
      VALUES ($1, $2, $3, COALESCE($4, ARRAY[]::text[]), $5::jsonb)
      RETURNING id, flow_id, name, description, categories, flow_json, created_at, updated_at
      `,
      [remoteFlowId || null, name, description || null, categories || null, JSON.stringify(flow_json)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/whatsapp/flows/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, categories, flow_json, flow_id, publish, endpoint_uri } = req.body || {};

    const existingResult = await db.query(
      `
      SELECT id, flow_id, name, description, categories, flow_json
      FROM whatsapp_flows
      WHERE id = $1
      `,
      [id]
    );

    if (existingResult.rowCount === 0) {
      const err = new Error('Flow not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }

    const existing = existingResult.rows[0];

    const nextName = typeof name === 'undefined' ? existing.name : name;
    const nextDescription = typeof description === 'undefined' ? existing.description : description;
    const nextCategories = typeof categories === 'undefined' ? existing.categories : categories;
    const nextFlowJson = typeof flow_json === 'undefined' ? existing.flow_json : flow_json;

    let remoteFlowId = flow_id || existing.flow_id || null;

    try {
      const endpointUri =
        endpoint_uri ||
        (nextFlowJson &&
          typeof nextFlowJson === 'object' &&
          nextFlowJson.meta &&
          typeof nextFlowJson.meta.endpoint_uri === 'string'
          ? nextFlowJson.meta.endpoint_uri
          : undefined);

      if (!remoteFlowId) {
        const created = await whatsappClient.createFlow({
          name: nextName,
          categories: nextCategories,
          flowJson: nextFlowJson,
          publish: typeof publish === 'boolean' ? publish : true,
          endpointUri,
        });
        if (created && created.id) {
          remoteFlowId = created.id;
        }
      } else {
        if (nextFlowJson) {
          await whatsappClient.updateFlowJson(remoteFlowId, nextFlowJson);
        }

        const metadataPayload = {};
        if (typeof nextName !== 'undefined') {
          metadataPayload.name = nextName;
        }
        if (typeof nextCategories !== 'undefined') {
          metadataPayload.categories = nextCategories;
        }
        if (endpointUri) {
          metadataPayload.endpoint_uri = endpointUri;
        }

        if (Object.keys(metadataPayload).length > 0) {
          await whatsappClient.updateFlowMetadata(remoteFlowId, metadataPayload);
        }
      }
    } catch (err) {
      return sendFlowMetaError(res, err, 'Failed to update WhatsApp Flow');
    }

    const result = await db.query(
      `
      UPDATE whatsapp_flows
      SET
        flow_id = COALESCE($1, flow_id),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        categories = COALESCE($4, categories),
        flow_json = COALESCE($5::jsonb, flow_json),
        updated_at = NOW()
      WHERE id = $6
      RETURNING id, flow_id, name, description, categories, flow_json, created_at, updated_at
      `,
      [
        remoteFlowId || (typeof flow_id === 'undefined' ? null : flow_id),
        typeof name === 'undefined' ? null : name,
        typeof description === 'undefined' ? null : description,
        typeof categories === 'undefined' ? null : categories,
        typeof flow_json === 'undefined' ? null : JSON.stringify(flow_json),
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/whatsapp/flows/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM whatsapp_flows WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      const err = new Error('Flow not found');
      err.status = 404;
      err.expose = true;
      throw err;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
