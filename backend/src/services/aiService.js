const { OpenAI } = require("openai");
const db = require('../../db');
const axios = require('axios');
const cheerio = require('cheerio');
const pdf = require('pdf-parse');

// Initialize OpenAI (requires OPENAI_API_KEY env var)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

/**
 * Scrape text from a URL
 */
async function scrapeWebsite(url) {
  try {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const $ = cheerio.load(data);
    // Remove scripts, styles, and other non-content elements
    $('script, style, nav, footer, header').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return text;
  } catch (error) {
    console.error(`[AI Agent] Error scraping ${url}:`, error.message);
    return null;
  }
}

/**
 * Extract text from PDF buffer
 */
async function parsePdf(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('[AI Agent] Error parsing PDF:', error.message);
    return null;
  }
}

/**
 * Main entry point to handle incoming messages for AI
 */
async function handleIncomingMessage(conversationId, messageText) {
  try {
    // 1. Check if AI is globally enabled
    const configRes = await db.query('SELECT * FROM ai_agent_config LIMIT 1');
    if (configRes.rows.length === 0 || !configRes.rows[0].is_active) {
      return null; // AI is off
    }
    const config = configRes.rows[0];

    // 2. Check if conversation is assigned to a human or AI disabled
    const convRes = await db.query('SELECT assignee_user_id, is_ai_active FROM conversations WHERE id = $1', [conversationId]);
    if (convRes.rows.length === 0) return null;
    
    const conv = convRes.rows[0];
    if (conv.assignee_user_id) {
      // Human assigned, AI should not reply
      return null; 
    }
    if (conv.is_ai_active === false) {
      // Explicitly disabled for this chat
      return null;
    }

    // 3. Retrieve Context (RAG)
    const context = await retrieveContext(messageText);

    // 4. Generate Response
    const response = await generateResponse(messageText, context, config.system_prompt, config.model_name);

    return response;

  } catch (err) {
    console.error('[AI Agent] Error handling message:', err);
    return null;
  }
}

/**
 * Simple retrieval (Mock for now, or basic text search)
 */
async function retrieveContext(query) {
  try {
    // In a real implementation, generate embedding for 'query' and search 'knowledge_base'
    // For now, we'll just fetch the most recent text content as context or do a simple ILIKE
    // This is a placeholder for vector search.
    
    const res = await db.query(
      `SELECT content, title FROM knowledge_base 
       WHERE is_active = true 
       ORDER BY created_at DESC LIMIT 3`
    );
    
    if (res.rows.length === 0) return '';

    return res.rows.map(row => `[Source: ${row.title}]\n${row.content?.substring(0, 500)}...`).join('\n\n');
  } catch (e) {
    console.error('[AI Agent] Retrieval error:', e);
    return '';
  }
}

/**
 * Call LLM
 */
async function generateResponse(userMessage, context, systemPrompt, model) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('[AI Agent] No API Key, skipping generation.');
      return null;
    }

    const messages = [
      { role: "system", content: `${systemPrompt}\n\nRelevant Context:\n${context}` },
      { role: "user", content: userMessage }
    ];

    const completion = await openai.chat.completions.create({
      messages,
      model: model || "gpt-4-turbo",
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  } catch (e) {
    console.error('[AI Agent] Generation error:', e);
    return null;
  }
}

module.exports = {
  handleIncomingMessage,
  scrapeWebsite,
  parsePdf,
  retrieveContext,
  generateResponse
};
