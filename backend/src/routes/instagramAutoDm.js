'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');

async function getInstagramChannelId(explicitChannelId) {
  if (explicitChannelId) {
    return explicitChannelId;
  }
  const res = await db.query(
    `SELECT id FROM channels WHERE type = 'instagram' ORDER BY created_at ASC LIMIT 1`
  );
  if (res.rowCount === 0) {
    return null;
  }
  return res.rows[0].id;
}

router.get('/instagram/auto-dm-config', async (req, res, next) => {
  try {
    const explicitChannelId = req.query.channelId || null;
    const channelId = await getInstagramChannelId(explicitChannelId);

    if (!channelId) {
      return res.json({
        channel: null,
        rules: {
          stories: {
            enabled: true,
            triggerType: 'any',
            keywords: '',
            message:
              'Thanks for replying to our story. We will DM you with more details shortly.',
          },
          posts: {
            enabled: true,
            triggerType: 'any',
            keywords: '',
            message:
              'Thanks for engaging with our post. We will DM you with more details shortly.',
          },
        },
      });
    }

    const channelRes = await db.query(
      `SELECT id, name, external_id FROM channels WHERE id = $1`,
      [channelId]
    );
    const channel = channelRes.rows[0] || null;

    const rulesRes = await db.query(
      `SELECT scope, enabled, trigger_type, keywords, message_template
       FROM instagram_auto_dm_rules
       WHERE channel_id = $1`,
      [channelId]
    );

    const defaults = {
      stories: {
        enabled: true,
        triggerType: 'any',
        keywords: '',
        message:
          'Thanks for replying to our story. We will DM you with more details shortly.',
      },
      posts: {
        enabled: true,
        triggerType: 'any',
        keywords: '',
        message:
          'Thanks for engaging with our post. We will DM you with more details shortly.',
      },
    };

    const rules = { ...defaults };

    for (const row of rulesRes.rows) {
      const base = {
        enabled: row.enabled,
        triggerType: row.trigger_type,
        keywords: row.keywords || '',
        message: row.message_template,
      };
      if (row.scope === 'story_reply') {
        rules.stories = base;
      } else if (row.scope === 'post_comment') {
        rules.posts = base;
      }
    }

    res.json({
      channel,
      rules,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/instagram/auto-dm-config', async (req, res, next) => {
  const payload = req.body || {};
  const explicitChannelId = payload.channelId || null;
  let client;
  try {
    const channelId = await getInstagramChannelId(explicitChannelId);
    if (!channelId) {
      const err = new Error('Instagram channel not found');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const rules = payload.rules || {};
    const stories = rules.stories || {};
    const posts = rules.posts || {};

    client = await db.getClient();
    await client.query('BEGIN');

    await client.query(
      `
      INSERT INTO instagram_auto_dm_rules (
        channel_id, scope, enabled, trigger_type, keywords, message_template
      )
      VALUES ($1, 'story_reply', $2, $3, $4, $5)
      ON CONFLICT (channel_id, scope)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        trigger_type = EXCLUDED.trigger_type,
        keywords = EXCLUDED.keywords,
        message_template = EXCLUDED.message_template,
        updated_at = NOW()
      `,
      [
        channelId,
        stories.enabled !== undefined ? !!stories.enabled : true,
        stories.triggerType || 'any',
        stories.keywords || '',
        stories.message ||
          'Thanks for replying to our story. We will DM you with more details shortly.',
      ]
    );

    await client.query(
      `
      INSERT INTO instagram_auto_dm_rules (
        channel_id, scope, enabled, trigger_type, keywords, message_template
      )
      VALUES ($1, 'post_comment', $2, $3, $4, $5)
      ON CONFLICT (channel_id, scope)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        trigger_type = EXCLUDED.trigger_type,
        keywords = EXCLUDED.keywords,
        message_template = EXCLUDED.message_template,
        updated_at = NOW()
      `,
      [
        channelId,
        posts.enabled !== undefined ? !!posts.enabled : true,
        posts.triggerType || 'any',
        posts.keywords || '',
        posts.message ||
          'Thanks for engaging with our post. We will DM you with more details shortly.',
      ]
    );

    await client.query('COMMIT');

    const channelRes = await db.query(
      `SELECT id, name, external_id FROM channels WHERE id = $1`,
      [channelId]
    );
    const channel = channelRes.rows[0] || null;

    res.json({
      channel,
      rules: {
        stories: {
          enabled: stories.enabled !== undefined ? !!stories.enabled : true,
          triggerType: stories.triggerType || 'any',
          keywords: stories.keywords || '',
          message:
            stories.message ||
            'Thanks for replying to our story. We will DM you with more details shortly.',
        },
        posts: {
          enabled: posts.enabled !== undefined ? !!posts.enabled : true,
          triggerType: posts.triggerType || 'any',
          keywords: posts.keywords || '',
          message:
            posts.message ||
            'Thanks for engaging with our post. We will DM you with more details shortly.',
        },
      },
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
    }
    next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;

