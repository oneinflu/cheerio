'use strict';
const express = require('express');
const router = express.Router();
const whatsappClient = require('../integrations/meta/whatsappClient');
const db = require('../../db');
const auth = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const cloudinaryLib = require('cloudinary').v2;
const waConfig = require('../utils/whatsappConfig');

async function resolveTeamId(req) {
  if (req.query && req.query.teamId) return req.query.teamId;
  if (req.user && Array.isArray(req.user.teamIds) && req.user.teamIds.length > 0) {
    return req.user.teamIds[0];
  }
  if (req.user && req.user.id) {
    try {
      const res = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [req.user.id]);
      const t = res.rows[0]?.team_id;
      if (t) return t;
    } catch (e) {}
  }
  return 'default';
}
const HAS_CLOUDINARY =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (HAS_CLOUDINARY) {
  cloudinaryLib.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * GET /api/templates
 * List all templates for the configured WABA.
 */
router.get('/', async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const { phoneNumberId } = req.query;
    
    let configs = [];
    if (phoneNumberId) {
      try {
        const config = await waConfig.getConfigByPhone(phoneNumberId);
        if (config.isCustom || config.phoneNumberId) configs = [config];
      } catch (e) {
        configs = [];
      }
    } else {
      configs = await waConfig.getAllConfigs(teamId);
    }

    let allMetaTemplates = [];
    for (const config of configs) {
      const wabaId = config.businessAccountId;
      if (!wabaId) continue;

      console.log(`[templates] Fetching templates for WABA: ${wabaId} (Phone: ${config.phoneNumberId})`);
      try {
        const resp = await whatsappClient.getTemplates(wabaId, 100, config);
        const metaTemplates = resp.data && resp.data.data ? resp.data.data : [];
        // Tag with source info
        allMetaTemplates.push(...metaTemplates.map(t => ({
          ...t,
          wabaId,
          phoneNumberId: config.phoneNumberId,
          displayPhoneNumber: config.displayPhoneNumber
        })));
      } catch (apiErr) {
        console.error(`[templates] Failed to fetch for WABA ${wabaId}:`, apiErr.message);
      }
    }

    // Fetch local templates
    let localTemplates = [];
    const client = await db.getClient();
    let settingsMap = new Map();
    try {
      const settingsRes = await client.query('SELECT template_name, is_starred, course_group FROM template_settings');
      settingsRes.rows.forEach(r => settingsMap.set(r.template_name, r));
      
      const localRes = await client.query('SELECT * FROM whatsapp_templates');
      localTemplates = localRes.rows.map(t => ({
        id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        components: t.components,
        status: t.status, // 'LOCAL'
        last_updated_time: t.updated_at,
        isLocal: true
      }));
    } catch (dbErr) {
      console.error('[templates] DB Error:', dbErr.message);
    } finally {
      client.release();
    }

    const merged = [...allMetaTemplates, ...localTemplates];
    const enriched = merged.map(t => {
      const s = settingsMap.get(t.name) || {};
      return {
        ...t,
        is_starred: !!s.is_starred,
        course_group: s.course_group || null
      };
    });

    res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/templates/:name/star
 * Mark a template as starred.
 */
router.post('/:name/star', async (req, res, next) => {
  const { name } = req.params;
  const client = await db.getClient();
  try {
    await client.query(
      `INSERT INTO template_settings (template_name, is_starred, updated_at)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (template_name) 
       DO UPDATE SET is_starred = TRUE, updated_at = NOW()`,
      [name]
    );
    res.json({ success: true, name, is_starred: true });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/templates/:name/star
 * Unstar a template.
 */
router.delete('/:name/star', async (req, res, next) => {
  const { name } = req.params;
  const client = await db.getClient();
  try {
    await client.query(
      `INSERT INTO template_settings (template_name, is_starred, updated_at)
       VALUES ($1, FALSE, NOW())
       ON CONFLICT (template_name) 
       DO UPDATE SET is_starred = FALSE, updated_at = NOW()`,
      [name]
    );
    res.json({ success: true, name, is_starred: false });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/templates/:name/group
 * Move a template to a specific course group.
 */
router.post('/:name/group', async (req, res, next) => {
  const { name } = req.params;
  const { group } = req.body; // e.g. "CPA", "ACCA", "EA", "CMA US", or null/General
  const client = await db.getClient();
  try {
    await client.query(
      `INSERT INTO template_settings (template_name, course_group, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (template_name) 
       DO UPDATE SET course_group = EXCLUDED.course_group, updated_at = NOW()`,
      [name, group]
    );
    res.json({ success: true, name, course_group: group });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/templates
 * Create a new message template.
 */
router.post('/', async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const { phoneNumberId } = req.body;
    
    let config;
    if (phoneNumberId) {
      config = await waConfig.getConfigByPhone(phoneNumberId);
    } else {
      config = await waConfig.getConfig(teamId);
    }
    
    const wabaId = config.businessAccountId;

    if (!wabaId) {
      const err = new Error('WhatsApp Business Account ID is not configured in settings');
      err.status = 500;
      err.expose = true;
      return next(err);
    }
    const resp = await whatsappClient.createTemplate(wabaId, req.body, config);
    res.json(resp.data);
  } catch (err) {
    const e = new Error(err.message || 'Template creation failed');
    e.status = err.status || 500;
    e.expose = true;
    return next(e);
  }
});

/**
 * POST /api/templates/upload-example
 * Upload media for template example (returns handle).
 */
router.post('/upload-example', upload.single('file'), async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const { phoneNumberId } = req.body;
    let config;
    if (phoneNumberId) {
      config = await waConfig.getConfigByPhone(phoneNumberId);
    } else {
      config = await waConfig.getConfig(teamId);
    }
    const WABA_ID = config.businessAccountId;

    if (!WABA_ID) {
      const err = new Error('WhatsApp Business Account ID is not configured in settings');
      err.status = 500;
      err.expose = true;
      return next(err);
    }
  if (!req.file) {
    const err = new Error('File is required');
    err.status = 400;
    err.expose = true;
    return next(err);
  }

    const resp = await whatsappClient.uploadMessageTemplateMedia(
      WABA_ID,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      config
    );

    let cloudinaryUrl = null;
    if (HAS_CLOUDINARY) {
      try {
        const base64 = req.file.buffer.toString('base64');
        const dataUri = `data:${req.file.mimetype};base64,${base64}`;
        const cloudResult = await cloudinaryLib.uploader.upload(dataUri, {
          resource_type: 'auto',
          folder: process.env.CLOUDINARY_FOLDER || 'whatsapp_media',
          use_filename: true,
          unique_filename: true,
        });
        cloudinaryUrl = cloudResult.secure_url;
        console.log(`[templates] Concurrently uploaded template media to Cloudinary: ${cloudinaryUrl}`);
      } catch (cloudErr) {
        console.error('[templates] Failed to concurrently upload template media to Cloudinary:', cloudErr.message);
      }
    }

    res.json({ ...resp, cloudinary_url: cloudinaryUrl });
  } catch (err) {
    const e = new Error(err.message || 'Template media upload failed');
    e.status = err.status || 500;
    e.expose = true;
    return next(e);
  }
});

/**
 * POST /api/templates/upload-test-media
 * Upload media for test template sending (returns URL or ID).
 *
 * This uses Cloudinary (if configured) and returns a payload similar to
 * the /api/whatsapp/upload endpoint: { id, url, kind, mime_type, original_filename }.
 */
router.post('/upload-test-media', auth.requireRole('admin', 'agent', 'supervisor'), upload.single('file'), async (req, res, next) => {
  try {
    if (!HAS_CLOUDINARY) {
      const err = new Error('Cloudinary is not configured for media uploads');
      err.status = 500;
      err.expose = true;
      throw err;
    }
    if (!req.file) {
      const err = new Error('File is required');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    const base64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${base64}`;

    let cloudResult;
    try {
      cloudResult = await cloudinaryLib.uploader.upload(dataUri, {
        resource_type: 'auto',
        folder: process.env.CLOUDINARY_FOLDER || 'whatsapp_media',
        use_filename: true,
        unique_filename: true,
      });
    } catch (cloudErr) {
      const err = new Error(`[upload-test-media] Cloudinary upload failed: ${cloudErr.message}`);
      err.status = 500;
      err.expose = true;
      throw err;
    }

    if (!cloudResult || !cloudResult.secure_url) {
      const err = new Error('Cloudinary upload did not return a secure_url');
      err.status = 500;
      err.expose = true;
      throw err;
    }

    const mimeType = req.file.mimetype || null;
    const kind =
      mimeType && mimeType.startsWith('image/')
        ? 'image'
        : mimeType && mimeType.startsWith('video/')
          ? 'video'
          : mimeType && mimeType.startsWith('audio/')
            ? 'audio'
            : 'document';

    res.status(200).json({
      id: cloudResult.secure_url,
      url: cloudResult.secure_url,
      cloudinary_public_id: cloudResult.public_id,
      kind,
      mime_type: mimeType,
      original_filename: req.file.originalname || null,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/templates/send-test
 * Send a test template message.
 */
router.post('/send-test', async (req, res, next) => {
  const { to, templateName, languageCode, components, phoneNumberId } = req.body;
  if (!to || !templateName) {
    const err = new Error('Missing "to" or "templateName"');
    err.status = 400;
    err.expose = true;
    return next(err);
  }

  // If WABA ID is missing, we can't send via the standard flow easily,
  // but standard message sending usually relies on Phone Number ID, not WABA ID directly.
  // The 'sendTemplateMessage' function in whatsappClient should handle this.

  try {
    const teamId = await resolveTeamId(req);
    let config;
    if (phoneNumberId) {
      config = await waConfig.getConfigByPhone(phoneNumberId);
    } else {
      config = await waConfig.getConfig(teamId);
    }

    const resp = await whatsappClient.sendTemplateMessage(
      to,
      templateName,
      languageCode || 'en_US',
      components,
      null,
      config
    );
    res.json(resp.data);
  } catch (err) {
    // Surface Meta error details to the client instead of a generic message.
    const e = new Error(
      (err.response && err.response.error && err.response.error.message) ||
      err.message ||
      'Template send failed'
    );
    e.status = err.status || 500;
    e.expose = true;
    return next(e);
  }
});

/**
 * DELETE /api/templates
 * Delete a template by name (and optional hsm_id).
 */
/**
 * POST /api/templates/bulk-create
 * Bulk create templates based on a .md file upload.
 */
router.post('/bulk-create', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new Error('MD file is required');
    const content = req.file.buffer.toString('utf8');
    const teamId = await resolveTeamId(req);
    const { phoneNumberId } = req.body;
    
    let config;
    if (phoneNumberId) {
      config = await waConfig.getConfigByPhone(phoneNumberId);
    } else {
      config = await waConfig.getConfig(teamId);
    }
    const wabaId = config.businessAccountId;

    if (!wabaId) throw new Error('WABA ID not configured');

    // Simple parser for NorthStar .md format
    const blocks = content.split(/---|\*WhatsApp \d+ –/).filter(b => b.trim().length > 10);
    const templatesToCreate = blocks.map((block, idx) => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const title = lines[0] || `Bulk Template ${idx + 1}`;
      const name = title.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').substring(0, 512);
      
      const attachmentLines = lines.filter(l => l.includes('drive.google.com') || l.includes('http'));
      const bodyLines = lines.filter(l => !l.startsWith('📎') && !l.includes('drive.google.com') && !l.includes('http') && !l.includes('WhatsApp'));
      
      const body = bodyLines.join('\n');
      const attachments = attachmentLines.map(l => {
        const m = l.match(/\[(.*?)\]\((.*?)\)/);
        return m ? { label: m[1], url: m[2] } : { label: 'Link', url: l.replace(/📎|\*|Attached:|\(|\)/g, '').trim() };
      });

      return { name, title, body, attachments };
    });

    const results = [];
    console.log(`[BulkCreate] Starting creation of ${templatesToCreate.length} templates...`);

    for (const t of templatesToCreate) {
      try {
        const components = [];
        
        // 1. Process first attachment as Header if it looks like an image/doc
        const first = t.attachments[0];
        if (first && (first.url.includes('jpg') || first.url.includes('pdf') || first.url.includes('jpeg') || first.url.includes('png') || first.url.includes('drive.google.com/file'))) {
            // We'll treat Google Drive file links as documents by default for drip camapaigns
            const isImage = first.url.toLowerCase().match(/\.(jpg|jpeg|png)/);
            const format = isImage ? 'IMAGE' : 'DOCUMENT';
            
            // To make it fully automated like the script, we would need to download and upload here.
            // For now, we'll try to use the URL as a handle example if it's direct, 
            // but since it's Drive, we usually need a handle.
            // We'll skip headers in bulk for now unless we have a robust handle resolver here.
            // Actually, I'll use a placeholder or skip to keep it reliable.
        }

        // 2. Body
        const bodyText = t.body.replace(/\*{{Name}}\*/g, '{{1}}').replace(/{{Name}}/g, '{{1}}');
        const bodyComp = { type: 'BODY', text: bodyText };
        if (bodyText.includes('{{1}}')) {
           bodyComp.example = { body_text: [['Student']] };
        }
        components.push(bodyComp);

        // 3. Buttons
        if (t.attachments.length > 0) {
            components.push({
                type: 'BUTTONS',
                buttons: t.attachments.slice(0, 2).map(a => ({
                    type: 'URL',
                    text: a.label.substring(0, 25),
                    url: a.url
                }))
            });
        }

        const resp = await whatsappClient.createTemplate(wabaId, {
            name: t.name,
            category: 'MARKETING',
            language: 'en_US',
            components
        }, config);

        results.push({ name: t.name, status: 'SUCCESS', id: resp.data.id });
      } catch (err) {
        results.push({ name: t.name, status: 'FAILED', error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

router.delete('/', async (req, res, next) => {
  const { name, hsm_id, phoneNumberId } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'Template name is required' });
  }
  try {
    const teamId = await resolveTeamId(req);
    let config;
    if (phoneNumberId) {
      config = await waConfig.getConfigByPhone(phoneNumberId);
    } else {
      config = await waConfig.getConfig(teamId);
    }
    const wabaId = config.businessAccountId;

    if (!wabaId) {
      const err = new Error('WhatsApp Business Account ID is not configured in settings');
      err.status = 500;
      return next(err);
    }

    console.log(`[templates] Deleting template: ${name} (ID: ${hsm_id || 'ALL'}) for WABA ${wabaId}`);
    const resp = await whatsappClient.deleteTemplate(wabaId, name, hsm_id, config);
    res.json(resp.data || { success: true });
  } catch (err) {
    next(err);
  }
});


module.exports = router;
