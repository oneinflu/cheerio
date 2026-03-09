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
    
    // RULE: AI stops ONLY if a human is assigned OR AI is explicitly disabled
    if (conv.assignee_user_id) {
      console.log(`[AI Agent] Skipping conversation ${conversationId} (Human Assigned: ${conv.assignee_user_id})`);
      return null; 
    }
    
    if (conv.is_ai_active === false) {
      console.log(`[AI Agent] Skipping conversation ${conversationId} (AI Disabled Manually)`);
      return null;
    }

    console.log(`[AI Agent] Processing message for conversation ${conversationId}`);

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
    // Basic Keyword Search (Better than just fetching latest)
    // We split query into keywords and try to match content
    const keywords = query.split(' ').filter(w => w.length > 3).map(w => `%${w}%`);
    
    let res;
    if (keywords.length > 0) {
        // Construct dynamic ILIKE query
        const conditions = keywords.map((_, i) => `content ILIKE $${i + 1}`).join(' OR ');
        res = await db.query(
            `SELECT content, title, source_url FROM knowledge_base 
             WHERE is_active = true AND (${conditions})
             ORDER BY created_at DESC LIMIT 3`,
            keywords
        );
    } else {
        // Fallback to latest
        res = await db.query(
            `SELECT content, title, source_url FROM knowledge_base 
             WHERE is_active = true 
             ORDER BY created_at DESC LIMIT 3`
        );
    }
    
    // If keyword search fails, fetch *everything* (up to a limit) to ensure we have context
    // This is crucial for small knowledge bases where "latest" might not be relevant
    if (res.rows.length === 0) {
        res = await db.query(
            `SELECT content, title, source_url FROM knowledge_base 
             WHERE is_active = true 
             ORDER BY created_at DESC LIMIT 5`
        );
    }

    if (res.rows.length === 0) return '';

    return res.rows.map(row => {
        // Truncate very long content to fit context window
        const snippet = row.content ? row.content.substring(0, 3000) : ''; 
        return `[Source: ${row.title} (${row.source_url || 'Upload'})]\n${snippet}...`;
    }).join('\n\n');
  } catch (e) {
    console.error('[AI Agent] Retrieval error:', e);
    return '';
  }
}

/**
 * Call LLM
 */
async function generateResponse(userMessage, context, systemPrompt, model, isStreaming = false) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('[AI Agent] No API Key, skipping generation.');
      return null;
    }

    const messages = [
      { role: "system", content: `${systemPrompt}\n\nRelevant Context:\n${context}` },
      { role: "user", content: userMessage }
    ];

    if (isStreaming) {
      const stream = await openai.chat.completions.create({
        messages,
        model: model || "gpt-4-turbo",
        temperature: 0.7,
        stream: true,
      });
      return stream;
    }

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
