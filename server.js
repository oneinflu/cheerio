'use strict';
require('dotenv').config(); // Load environment variables from .env
/**
 * server.js
 *
 * Purpose:
 * - Bootstraps the HTTP server.
 * - Loads the Express app.
 * - Applies environment-based configuration (e.g., port).
 * - Implements graceful shutdown so we don’t lose requests or leak DB connections.
 *
 * Notes for junior engineers:
 * - Keep server startup focused on HTTP lifecycle. Business logic belongs in app/services.
 * - Graceful shutdown is critical in production to avoid corrupt states or dropped requests.
 */

const http = require('http');
const app = require('./app');
const db = require('./db');
const { init: initIO } = require('./src/realtime/io');

// Read environment configuration with sensible defaults for local development.
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 3000);

/**
 * Create the HTTP server using our Express app.
 * We keep this as a separate object so we can close it cleanly on shutdown.
 */
const server = http.createServer(app);

/**
 * Start listening for incoming requests.
 * We log minimal operational info (no secrets) so ops can confirm the app is up.
 */
server.listen(PORT, () => {
  // Avoid logging sensitive data. Only environment and port are printed.
  console.log(`[server] Listening on port ${PORT} (env=${NODE_ENV})`);
  // Initialize Socket.IO after HTTP server starts.
  initIO(server);
});

/**
 * Helper: Graceful shutdown
 * - Stops accepting new connections.
 * - Gives in-flight requests a short window to finish.
 * - Closes the PostgreSQL pool.
 *
 * This is important for deployments and restarts.
 */
async function shutdown(signal) {
  try {
    console.log(`[server] Received ${signal}. Starting graceful shutdown...`);
    // Stop accepting new connections.
    await new Promise((resolve) => server.close(resolve));
    console.log('[server] HTTP server closed.');
  } catch (err) {
    console.error('[server] Error closing HTTP server:', err);
  }

  try {
    // Close DB pool to release connections.
    await db.close();
    console.log('[server] Database pool closed.');
  } catch (err) {
    console.error('[server] Error closing database pool:', err);
  }

  // Exit with success. If there were errors above, ops will capture them in logs.
  process.exit(0);
}

/**
 * Register OS signals for clean shutdown.
 * Kubernetes, PM2, and other orchestrators send SIGTERM during deploy/stop.
 */
['SIGTERM', 'SIGINT'].forEach((sig) => {
  process.on(sig, () => {
    // Prevent multiple calls if multiple signals fire.
    const alreadyClosing = shutdown.inProgress;
    if (alreadyClosing) return;
    shutdown.inProgress = true;
    shutdown(sig);
  });
});

/**
 * Safety net: If the process encounters an uncaught error,
 * we log and exit rather than leaving the app in a broken state.
 * In production, a supervisor (e.g., systemd/Kubernetes/PM2) will restart it.
 */
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
  process.exit(1);
});
