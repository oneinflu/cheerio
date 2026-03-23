'use strict';
/**
 * migrate.js
 * 
 * Run this script to:
 * 1. Ensure the instagram_automations table exists.
 * 2. Clear out existing Instagram channels for a fresh start.
 * 
 * Usage: node migrate.js
 */

require('dotenv').config();
const { Pool } = require('pg');

console.log('Connecting to:', process.env.DATABASE_URL?.split('@')[1] || 'URL MISSING');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('--- Starting Migration ---');
  let client;
  try {
    console.log('Connecting to pool...');
    client = await pool.connect();
    console.log('Successfully connected to DB.');

    // 1. Create table
    console.log('Creating instagram_automations table if it doesn\'t exist...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS instagram_automations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN ('auto_reply', 'comment_dm', 'auto_dm')),
        name VARCHAR(255) NOT NULL,
        trigger_config JSONB NOT NULL DEFAULT '{}',
        action_config JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating workflow_runs table for reporting...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        phone_number    VARCHAR(50) NOT NULL,
        status          VARCHAR(20) NOT NULL,
        execution_log   JSONB NOT NULL DEFAULT '[]',
        context_preview JSONB NOT NULL DEFAULT '{}',
        error_message   TEXT,
        started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at        TIMESTAMPTZ,
        duration_ms     INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_wf_id ON workflow_runs(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(started_at DESC);
    `);
    console.log('Table workflow_runs exists or created.');
    
    console.log('Creating index if doesn\'t exist...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_instagram_automations_channel_type 
      ON instagram_automations(channel_id, type, is_active);
    `);
    console.log('Index exists or created.');

    // 2. Patch specific account IDs as a safety fallback
    console.log('Patching NorthStar Academy channel with shadow alias ID...');
    const patchRes = await client.query(`
      UPDATE channels 
      SET config = config || '{"aliasIds": ["17841444656386264"]}'::jsonb 
      WHERE (name = '@northstaracad' OR external_id = '1398694730214399') 
      AND type = 'instagram';
    `);
    console.log(`Patched ${patchRes.rowCount} channel(s) with alias IDs.`);

    // NOTE: We disabled the 'DELETE FROM channels' for safety now that live accounts are connected.
    // To clear channels, run the DELETE command manually if ever needed.

    console.log('--- Migration Completed Successfully ---');
  } catch (err) {
    console.error('Migration failed:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

run();
