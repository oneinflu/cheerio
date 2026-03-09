'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// ─── AI Config ───────────────────────────────────────────────────────────────

/**
 * GET /api/ai-agent/config
 * Get current AI configuration
 */
router.get('/config', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM ai_agent_config LIMIT 1');
    if (result.rows.length === 0) {
      // Create default if missing
      const ins = await db.query('INSERT INTO ai_agent_config (is_active) VALUES (false) RETURNING *');
      return res.json(ins.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/ai-agent/config
 * Update AI configuration (status, prompt, model)
 */
router.put('/config', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { is_active, system_prompt, model_name, temperature } = req.body;
    
    // Update the single config row
    const result = await db.query(
      `UPDATE ai_agent_config 
       SET is_active = COALESCE($1, is_active),
           system_prompt = COALESCE($2, system_prompt),
           model_name = COALESCE($3, model_name),
           temperature = COALESCE($4, temperature),
           updated_at = NOW()
       RETURNING *`,
      [is_active, system_prompt, model_name, temperature]
    );
    
    if (result.rowCount === 0) {
        // Fallback insert
        const ins = await db.query(
            `INSERT INTO ai_agent_config (is_active, system_prompt, model_name, temperature) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [is_active || false, system_prompt || '', model_name || 'gpt-4-turbo', temperature || 0.7]
        );
        return res.json(ins.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ─── Knowledge Base ──────────────────────────────────────────────────────────

/**
 * GET /api/ai-agent/knowledge
 * List all knowledge sources
 */
router.get('/knowledge', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM knowledge_base ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

const aiService = require('../services/aiService');

/**
 * POST /api/ai-agent/test
 * Test the AI with a message (supports streaming)
 */
router.post('/test', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { message, stream } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Retrieve global config
    const configRes = await db.query('SELECT * FROM ai_agent_config LIMIT 1');
    const config = configRes.rows[0];

    // Retrieve context
    const context = await aiService.retrieveContext(message);
    
    if (stream) {
        // Handle streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const streamResponse = await aiService.generateResponse(
            message, 
            context, 
            config ? config.system_prompt : '', 
            config ? config.model_name : 'gpt-4-turbo',
            true // isStreaming
        );

        if (!streamResponse) {
             res.write('data: [ERROR]\n\n');
             return res.end();
        }

        for await (const chunk of streamResponse) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                // Send data as SSE
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }
        
        res.write('data: [DONE]\n\n');
        res.end();
    } else {
        // Normal JSON response
        const response = await aiService.generateResponse(
          message, 
          context, 
          config ? config.system_prompt : '', 
          config ? config.model_name : 'gpt-4-turbo'
        );
        res.json({ response });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai-agent/knowledge/text
 * Add text content (website URL or raw text)
 */
router.post('/knowledge/text', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { title, content, source_url, source_type } = req.body;
    
    let finalContent = content;
    
    // If it's a website, scrape it
    if (source_type === 'website' && source_url) {
       console.log(`[AI Agent] Scraping website: ${source_url}`);
       const scraped = await aiService.scrapeWebsite(source_url);
       if (scraped) {
         finalContent = scraped;
       } else {
         // Fallback if scraping fails (or just store URL)
         finalContent = `Website URL: ${source_url} (Content extraction failed)`;
       }
    }

    const result = await db.query(
      `INSERT INTO knowledge_base (title, content, source_url, source_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, finalContent, source_url, source_type]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai-agent/knowledge/upload
 * Upload PDF/Document
 */
router.post('/knowledge/upload', auth.requireRole('admin', 'super_admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const { title } = req.body;
    let extractedText = '';
    let sourceType = 'text';
    
    if (req.file.mimetype === 'application/pdf') {
       extractedText = await aiService.parsePdf(req.file.buffer);
       sourceType = 'pdf';
    } else {
       // Assume text-based
       extractedText = req.file.buffer.toString('utf-8');
    }

    if (!extractedText || extractedText.trim().length === 0) {
        extractedText = 'Content extraction failed or empty file.';
    }

    // In a real app, upload to S3/Cloud storage. Here we'll store extracted text.
    const fakeUrl = `uploads/${req.file.originalname}`;
    
    const result = await db.query(
      `INSERT INTO knowledge_base (title, source_url, source_type, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title || req.file.originalname, fakeUrl, sourceType, extractedText]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/ai-agent/knowledge/:id
 * Remove knowledge source
 */
router.delete('/knowledge/:id', auth.requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM knowledge_base WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
