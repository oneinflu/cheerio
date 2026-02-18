'use strict';

const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_TRANSLATE_MODEL = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4.1-mini';

async function detectAndTranslateToEnglish(text) {
  if (!OPENAI_API_KEY) {
    return null;
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return null;
  }

  const systemPrompt =
    'You detect language and translate text to English.\n' +
    'Return ONLY a JSON object like {"language_code":"hi","english_text":"..."}.\n' +
    'language_code must be ISO 639-1 (en, hi, ta, te, mr, etc).';

  try {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: OPENAI_TRANSLATE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    const choice =
      resp.data &&
      resp.data.choices &&
      resp.data.choices[0] &&
      resp.data.choices[0].message &&
      resp.data.choices[0].message.content;

    if (!choice || typeof choice !== 'string') {
      return null;
    }

    const start = choice.indexOf('{');
    const end = choice.lastIndexOf('}');
    const jsonText =
      start !== -1 && end !== -1 && end > start ? choice.slice(start, end + 1) : choice;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (_) {
      return null;
    }

    const languageCode = (parsed.language_code || '').toString().trim().toLowerCase() || null;
    const englishText = (parsed.english_text || '').toString();

    if (!languageCode || !englishText) {
      return null;
    }

    return {
      languageCode,
      englishText,
    };
  } catch (err) {
    console.warn(
      '[translation] detectAndTranslateToEnglish failed:',
      err.response && err.response.status,
      err.response && err.response.data ? err.response.data : err.message
    );
    return null;
  }
}

async function translateFromEnglish(text, targetLanguageCode) {
  if (!OPENAI_API_KEY) {
    return null;
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return null;
  }
  const lang = (targetLanguageCode || '').toString().trim();
  if (!lang) {
    return null;
  }

  const systemPrompt =
    'You translate text from English into the target language.\n' +
    'The target language code is: ' +
    lang +
    '. Respond with ONLY the translated text, nothing else.';

  try {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: OPENAI_TRANSLATE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    const choice =
      resp.data &&
      resp.data.choices &&
      resp.data.choices[0] &&
      resp.data.choices[0].message &&
      resp.data.choices[0].message.content;

    if (!choice || typeof choice !== 'string') {
      return null;
    }

    return choice.trim();
  } catch (err) {
    console.warn(
      '[translation] translateFromEnglish failed:',
      err.response && err.response.status,
      err.response && err.response.data ? err.response.data : err.message
    );
    return null;
  }
}

module.exports = {
  detectAndTranslateToEnglish,
  translateFromEnglish,
};

