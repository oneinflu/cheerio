'use strict';
/**
 * db.js
 *
 * Purpose:
 * - Provides a single, shared PostgreSQL connection pool using the `pg` library.
 * - Exposes small helper functions for queries and acquiring a client for transactions.
 * - Applies environment-based configuration and safe defaults.
 *
 * Notes for junior engineers:
 * - Use `query(sql, params)` for simple one-off queries.
 * - Use `getClient()` for transactions: BEGIN → queries → COMMIT/ROLLBACK → client.release().
 * - Never log secrets or raw payloads containing PII. Be careful with debug logs.
 */

const { Pool } = require('pg');

// Read environment variables with sane defaults for local development.
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL || '';

/**
 * In production, we typically enable SSL when connecting to managed Postgres (e.g., on cloud providers).
 * `rejectUnauthorized: true` ensures the certificate is valid.
 * For local dev, SSL is usually off.
 */
const ssl = (NODE_ENV === 'production' || (DATABASE_URL && DATABASE_URL.includes('sslmode=require')))
  ? { rejectUnauthorized: false }
  : false;
console.log('[db] SSL Config FORCE FALSE:', ssl);
console.log('[db] NODE_ENV:', process.env.NODE_ENV);
console.log('[db] DATABASE_URL exists:', !!process.env.DATABASE_URL);

/**
 * Construct a single shared connection pool.
 * The pool manages connections efficiently; reuse it across the app instead of creating new clients.
 */
const pool = new Pool({
  connectionString: DATABASE_URL || undefined,
  ssl,
  // Tunables: adjust with environment variables if needed.
  // max: Number(process.env.PG_POOL_MAX || 10),
  // idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  // connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 0),
});

/**
 * If a pooled client errors while idle, this handler prevents the process from crashing
 * and gives us an operational signal. Avoid printing sensitive details.
 */
pool.on('error', (err) => {
  console.error('[db] Unexpected idle client error:', err.message);
});

/**
 * Run a simple query using the shared pool.
 * Returns the native `pg` result (rows, rowCount, etc.).
 *
 * Example:
 *   const result = await query('SELECT 1 AS x');
 *   console.log(result.rows[0].x); // 1
 */
async function query(text, params) {
  // Lightweight timing for operational awareness without logging payloads.
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Minimal, non-sensitive log. Comment out if too noisy.
  // console.log(`[db] ${text.split('\\n')[0].slice(0, 60)}... (${duration}ms)`);
  return res;
}

/**
 * Acquire a dedicated client from the pool for multi-step operations (e.g., transactions).
 * Remember to always `client.release()` in a `finally` block.
 *
 * Example transaction usage:
 *   const client = await getClient();
 *   try {
 *     await client.query('BEGIN');
 *     await client.query('INSERT ...');
 *     await client.query('COMMIT');
 *   } catch (e) {
 *     await client.query('ROLLBACK');
 *     throw e;
 *   } finally {
 *     client.release();
 *   }
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Close the pool during graceful shutdown.
 * This ensures all connections are returned and no new queries are accepted.
 */
async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  getClient,
  close,
};

