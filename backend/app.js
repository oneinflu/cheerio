'use strict';
/**
 * app.js
 *
 * Purpose:
 * - Constructs and configures the Express application.
 * - Sets up base middlewares, health endpoints, and centralized error handling.
 * - Reads environment-based configuration relevant to the HTTP layer.
 *
 * Notes for junior engineers:
 * - Keep this file focused on web concerns (middleware, routing, error handling).
 * - Business logic belongs in services; DB code belongs in repositories.
 * - Avoid adding heavy dependencies here unless they are truly cross-cutting.
 */

const express = require('express');
const path = require('path');
const cors = require('cors'); // Added for widget support
const whatsappWebhookRouter = require('./src/webhooks/whatsapp');
const whatsappOutboundRouter = require('./src/routes/whatsappOutbound');
const conversationsRouter = require('./src/routes/conversations');
const staffNotesRouter = require('./src/routes/staffNotes');
const inboxRouter = require('./src/routes/inbox');
const messagesRouter = require('./src/routes/messages');
const templatesRouter = require('./src/routes/templates');
const mediaRouter = require('./src/routes/media');
const dashboardRouter = require('./src/routes/dashboard');
const workflowsRouter = require('./src/routes/workflows');
const rulesRouter = require('./src/routes/rules');
const authRouter = require('./src/routes/auth');
const teamRouter = require('./src/routes/team');
const auth = require('./src/middlewares/auth');

// Read environment-based config for HTTP concerns. Defaults are safe for dev.
const NODE_ENV = process.env.NODE_ENV || 'development';
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '1mb'; // raise if you expect large payloads

/**
 * Factory: create and configure the Express app.
 * Exporting a function isn’t strictly necessary, but keeps testability high.
 */
function createApp() {
  const app = express();

  /**
   * Core middleware
   * - JSON body parsing with explicit size limit to prevent abuse.
   * - Basic request context setup (e.g., attach env to req.locals for debugging).
   */
  app.use(express.json({
    limit: REQUEST_BODY_LIMIT,
    /**
     * For webhook signature verification we need the raw body bytes.
     * Capture them only for webhook paths to avoid overhead elsewhere.
     */
    verify: (req, res, buf) => {
      if (req.originalUrl && req.originalUrl.startsWith('/webhooks')) {
        req.rawBody = buf.toString('utf8');
      }
    }
  }));
  
  // Enable CORS for all routes (allows widget to be loaded from other domains)
  app.use(cors());

  // Serve static files for the widget
  app.use('/widget', express.static(path.join(__dirname, 'public')));

  app.use((req, res, next) => {
    // Minimal per-request context; do not attach sensitive info.
    req.locals = { env: NODE_ENV };
    next();
  });

  /**
   * Health and readiness endpoints
   * - /health: lightweight, used by load balancers and uptime monitors.
   * - /ready: indicate if dependencies (e.g., DB) are ready. Kept simple here.
   */
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', env: NODE_ENV });
  });
  app.get('/ready', (req, res) => {
    // In a more advanced setup, check DB connectivity or queues here.
    res.status(200).json({ ready: true });
  });

  /**
   * Apply authentication for API routes (staff-only surface).
   * Webhooks remain unauthenticated but signed by Meta.
   */
  app.use('/api', auth.requireAuth);

  /**
   * Example placeholder route (for onboarding):
   * New developers can add domain routes under src/routes and connect them here.
   * Keep controllers thin; call services for business logic.
   */
  // app.use('/api/conversations', conversationsRouter);
  // app.use('/api/messages', messagesRouter);
  app.use('/webhooks/whatsapp', whatsappWebhookRouter);
  app.use('/api/auth', authRouter); // Login
  app.use('/api/team-users', teamRouter); // Team Users
  app.use('/api/whatsapp', whatsappOutboundRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api', staffNotesRouter);
  app.use('/api', inboxRouter);
  app.use('/api', messagesRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/workflows', workflowsRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', rulesRouter);

  /**
   * Serve static assets in production.
   * Vite builds to the 'dist' folder.
   */
  if (NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '../frontend/dist');
    console.log(`[app] Serving static files from: ${frontendDist}`);
    
    app.use(express.static(frontendDist));

    // Handle SPA routing: serve index.html for any unknown non-API routes
    // Use RegExp to match all paths, compatible with Express 5
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  /**
   * 404 handler
   * - If no route handled the request, return a clear JSON response.
   */
  app.use((req, res, next) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found.',
    });
  });

  /**
   * Centralized error handler
   * - Catches errors thrown in routes/middlewares.
   * - Converts them into consistent HTTP responses.
   * - Avoids leaking implementation details or sensitive information.
   *
   * Conventions:
   * - Use `err.status` for HTTP status codes (default 500).
   * - Use `err.expose` to indicate safe messages for clients.
   * - Log errors with an external logger in production (kept minimal here).
   */
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = Number(err.status) || 500;
    const expose = Boolean(err.expose);

    // Minimal server-side logging to aid debugging (avoid PII).
    if (NODE_ENV !== 'test') {
      console.error('[app] Error:', {
        status,
        name: err.name,
        message: err.message,
        // stack omitted in production logs for brevity; enable if needed
      });
    }

    // Shape a client-safe error payload.
    const payload = {
      error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
      message: expose ? err.message : 'An unexpected error occurred.',
    };

    res.status(status).json(payload);
  });

  return app;
}

module.exports = createApp();
