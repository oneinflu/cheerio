const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const db = require('../db'); // Adjust path as needed

async function seedPrompts() {
  try {
    const promptsDir = path.join(__dirname, '../prompts');
    const baseDir = path.join(promptsDir, 'base');
    const intentsDir = path.join(promptsDir, 'intents');

    let combinedPrompt = "";

    // 1. Load Base Prompts
    if (fs.existsSync(baseDir)) {
      const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.txt'));
      const excluded = ['paywall_logic.txt', 'platform_features.txt', 'formatting_rules.txt', 'conversation_rules.txt'];
      for (const file of files) {
        if (excluded.includes(file)) continue;
        const content = fs.readFileSync(path.join(baseDir, file), 'utf-8');
        combinedPrompt += `\n\n--- ${file.replace('.txt', '').toUpperCase()} ---\n${content}`;
      }
    }

    // 2. Load Intent Prompts
    if (fs.existsSync(intentsDir)) {
      const files = fs.readdirSync(intentsDir).filter(f => f.endsWith('.txt'));
      const excluded = ['job_recommendation.txt', 'course_recommendation.txt', 'general.txt', 'course_doubt.txt', 'career_guidance.txt'];
      for (const file of files) {
        if (excluded.includes(file)) continue;
        const content = fs.readFileSync(path.join(intentsDir, file), 'utf-8');
        combinedPrompt += `\n\n--- INTENT: ${file.replace('.txt', '').toUpperCase()} ---\n${content}`;
      }
    }

    console.log('Generated System Prompt Length:', combinedPrompt.length);

    // 3. Update Database
    const res = await db.query('SELECT id FROM ai_agent_config LIMIT 1');
    if (res.rows.length === 0) {
      await db.query(
        'INSERT INTO ai_agent_config (is_active, system_prompt) VALUES ($1, $2)',
        [true, combinedPrompt]
      );
      console.log('Inserted new AI config with prompts.');
    } else {
      await db.query(
        'UPDATE ai_agent_config SET system_prompt = $1, updated_at = NOW()',
        [combinedPrompt]
      );
      console.log('Updated existing AI config with new prompts.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error seeding prompts:', err);
    process.exit(1);
  }
}

seedPrompts();
