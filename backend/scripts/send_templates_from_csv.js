'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const cloudinaryLib = require('cloudinary').v2;
const whatsappClient = require('../src/integrations/meta/whatsappClient');

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const TO = '919182151640';

const INPUT_CSV = path.join(__dirname, 'template_qa_results.csv');
const OUTPUT_CSV = path.join(__dirname, 'template_send_report.csv');

const MEDIA_FILES = {
  IMAGE: path.join(__dirname, '..', 'files', 'image.png'),
  VIDEO: path.join(__dirname, '..', 'files', 'video.mp4'),
  DOCUMENT: path.join(__dirname, '..', 'files', 'document.pdf'),
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function extractPositionalVarCount(text) {
  if (!text) return 0;
  const matches = String(text).match(/{{\s*\d+\s*}}/g);
  if (!matches) return 0;
  let max = 0;
  for (const m of matches) {
    const n = parseInt(m.replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max;
}

function sampleValuesForCategory(category, n) {
  const c = String(category || '').toUpperCase();
  if (c === 'AUTHENTICATION') {
    return Array.from({ length: n }, (_, i) => (i === 0 ? '123456' : '123456'));
  }
  if (c === 'UTILITY') {
    const base = ['John', '#123', 'TRK123456', '5', '12:30 PM'];
    return Array.from({ length: n }, (_, i) => base[i] || `VALUE${i + 1}`);
  }
  const base = ['John', '20', 'WELCOME20', 'Feb 27', 'Store'];
  return Array.from({ length: n }, (_, i) => base[i] || `VALUE${i + 1}`);
}

function getButtonMeta(components) {
  const btnComp = (components || []).find((c) => c && c.type === 'BUTTONS');
  const btns = btnComp && Array.isArray(btnComp.buttons) ? btnComp.buttons : [];
  return btns.map((b, idx) => ({ button: b, index: idx }));
}

async function uploadToCloudinary(kind) {
  const filePath = MEDIA_FILES[kind];
  if (!fs.existsSync(filePath)) throw new Error(`Missing media file: ${filePath}`);

  const folder = process.env.CLOUDINARY_FOLDER || 'whatsapp-template-qa';
  const publicId = `template-qa-${kind.toLowerCase()}-${Date.now()}`;

  if (kind === 'IMAGE') {
    const res = await cloudinaryLib.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
    });
    return res.secure_url;
  }

  if (kind === 'VIDEO') {
    const res = await cloudinaryLib.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      resource_type: 'video',
      overwrite: true,
    });
    return res.secure_url;
  }

  const res = await cloudinaryLib.uploader.upload(filePath, {
    folder,
    public_id: publicId,
    resource_type: 'raw',
    overwrite: true,
  });
  return res.secure_url;
}

function buildSendComponents(templateDef, mediaUrls) {
  const comps = Array.isArray(templateDef.components) ? templateDef.components : [];
  const out = [];

  const header = comps.find((c) => c && c.type === 'HEADER');
  if (header) {
    if (header.format === 'TEXT') {
      const n = extractPositionalVarCount(header.text);
      if (n > 0) {
        out.push({
          type: 'header',
          parameters: sampleValuesForCategory(templateDef.category, n).map((v) => ({ type: 'text', text: v })),
        });
      }
    } else if (header.format === 'IMAGE') {
      out.push({ type: 'header', parameters: [{ type: 'image', image: { link: mediaUrls.IMAGE } }] });
    } else if (header.format === 'VIDEO') {
      out.push({ type: 'header', parameters: [{ type: 'video', video: { link: mediaUrls.VIDEO } }] });
    } else if (header.format === 'DOCUMENT') {
      out.push({ type: 'header', parameters: [{ type: 'document', document: { link: mediaUrls.DOCUMENT } }] });
    }
  }

  const body = comps.find((c) => c && c.type === 'BODY');
  if (body) {
    const n = extractPositionalVarCount(body.text);
    if (n > 0) {
      out.push({
        type: 'body',
        parameters: sampleValuesForCategory(templateDef.category, n).map((v) => ({ type: 'text', text: v })),
      });
    }
  }

  const buttons = getButtonMeta(comps);
  for (const { button, index } of buttons) {
    if (!button || !button.type) continue;

    if (String(button.type).toUpperCase() === 'COPY_CODE') {
      const code = 'WELCOME20';
      out.push({
        type: 'button',
        sub_type: 'COPY_CODE',
        index,
        parameters: [{ type: 'coupon_code', coupon_code: code }],
      });
      continue;
    }

    if (String(button.type).toUpperCase() === 'URL') {
      const url = button.url || '';
      const needsVar = /{{\s*\d+\s*}}/.test(url);
      if (needsVar) {
        out.push({
          type: 'button',
          sub_type: 'url',
          index,
          parameters: [{ type: 'text', text: 'track' }],
        });
      }
      continue;
    }
  }

  if (String(templateDef.category).toUpperCase() === 'AUTHENTICATION') {
    const otpButtonIndex = buttons.findIndex((b) => b && b.button && b.button.otp_type);
    if (otpButtonIndex >= 0) {
      out.push({
        type: 'button',
        sub_type: 'url',
        index: otpButtonIndex,
        parameters: [{ type: 'text', text: '123456' }],
      });
    }
  }

  return out;
}

function csvEscape(v) {
  return `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
}

function readAlreadySentNames() {
  if (!fs.existsSync(OUTPUT_CSV)) return new Set();
  const raw = fs.readFileSync(OUTPUT_CSV, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return new Set();
  const header = parseCsvLine(lines[0]);
  const idxName = header.indexOf('TemplateName');
  const idxRes = header.indexOf('Result');
  const sent = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (idxName < 0 || idxRes < 0) continue;
    if (cols[idxRes] === 'SENT' && cols[idxName]) sent.add(cols[idxName]);
  }
  return sent;
}

async function sendWithRetry({ to, name, language, components }) {
  const maxAttempts = 6;
  let attempt = 0;
  let backoffMs = 2500;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const resp = await whatsappClient.sendTemplateMessage(to, name, language, components);
      return { ok: true, resp };
    } catch (err) {
      const apiError = err && err.response && err.response.error ? err.response.error : null;
      const code = apiError && apiError.code ? apiError.code : null;
      const subcode = apiError && apiError.error_subcode ? apiError.error_subcode : null;

      const isRateLimited = code === 131056 || code === 4 || subcode === 2446079;
      if (!isRateLimited || attempt >= maxAttempts) {
        return { ok: false, err };
      }

      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 60000);
    }
  }

  return { ok: false, err: new Error('Retry attempts exhausted') };
}

async function main() {
  if (!WABA_ID) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID missing');

  const hasCloudinary =
    !!process.env.CLOUDINARY_CLOUD_NAME &&
    !!process.env.CLOUDINARY_API_KEY &&
    !!process.env.CLOUDINARY_API_SECRET;
  if (!hasCloudinary) throw new Error('Cloudinary env vars missing (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)');

  cloudinaryLib.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  if (!fs.existsSync(INPUT_CSV)) throw new Error(`Missing input CSV: ${INPUT_CSV}`);

  const raw = fs.readFileSync(INPUT_CSV, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idxName = header.indexOf('TemplateName');
  const idxStatus = header.indexOf('Status');
  const idxCategory = header.indexOf('Category');
  if (idxName < 0 || idxStatus < 0) throw new Error('CSV missing required columns');

  const approved = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[idxName];
    const status = cols[idxStatus];
    const category = idxCategory >= 0 ? cols[idxCategory] : '';
    if (!name || name === 'INT') continue;
    if (String(category).toUpperCase() === 'SUMMARY') continue;
    if (String(status).toUpperCase() !== 'APPROVED') continue;
    approved.push(name);
  }

  const uniqueNames = Array.from(new Set(approved));

  const alreadySent = readAlreadySentNames();
  if (!fs.existsSync(OUTPUT_CSV)) {
    fs.writeFileSync(
      OUTPUT_CSV,
      'TemplateName,Category,Language,HeaderFormat,SentAt,Result,MetaResponse,Error,MediaUrlImage,MediaUrlVideo,MediaUrlDocument\n'
    );
  }

  const mediaUrls = {
    IMAGE: await uploadToCloudinary('IMAGE'),
    VIDEO: await uploadToCloudinary('VIDEO'),
    DOCUMENT: await uploadToCloudinary('DOCUMENT'),
  };

  const templatesResp = await whatsappClient.getTemplates(WABA_ID, 200);
  const templates = (templatesResp.data && templatesResp.data.data) ? templatesResp.data.data : [];
  const templateByName = new Map(templates.map((t) => [t.name, t]));
  const approvedByMeta = new Set(
    templates
      .filter((t) => t && t.name && String(t.status || '').toUpperCase() === 'APPROVED')
      .map((t) => t.name)
  );

  const report = {
    total: uniqueNames.length,
    sent: 0,
    failed: 0,
    missing: 0,
    skipped_not_approved: 0,
    skipped_already_sent: 0,
  };

  for (const name of uniqueNames) {
    if (alreadySent.has(name)) {
      report.skipped_already_sent++;
      continue;
    }

    const templateDef = templateByName.get(name);
    if (!templateDef) {
      report.missing++;
      fs.appendFileSync(
        OUTPUT_CSV,
        [
          csvEscape(name),
          csvEscape(''),
          csvEscape(''),
          csvEscape(''),
          csvEscape(new Date().toISOString()),
          csvEscape('SKIPPED'),
          csvEscape(''),
          csvEscape('Template not found in WABA'),
          csvEscape(mediaUrls.IMAGE),
          csvEscape(mediaUrls.VIDEO),
          csvEscape(mediaUrls.DOCUMENT),
        ].join(',') + '\n'
      );
      continue;
    }

    if (!approvedByMeta.has(name)) {
      report.skipped_not_approved++;
      fs.appendFileSync(
        OUTPUT_CSV,
        [
          csvEscape(name),
          csvEscape(templateDef.category || ''),
          csvEscape(templateDef.language || templateDef.language_code || 'en_US'),
          csvEscape(''),
          csvEscape(new Date().toISOString()),
          csvEscape('SKIPPED'),
          csvEscape(''),
          csvEscape(`Template status is ${templateDef.status || 'UNKNOWN'} (not APPROVED)`),
          csvEscape(mediaUrls.IMAGE),
          csvEscape(mediaUrls.VIDEO),
          csvEscape(mediaUrls.DOCUMENT),
        ].join(',') + '\n'
      );
      continue;
    }

    const language = templateDef.language || templateDef.language_code || 'en_US';
    const headerComp = Array.isArray(templateDef.components)
      ? templateDef.components.find((c) => c && c.type === 'HEADER')
      : null;
    const headerFormat = headerComp ? headerComp.format || '' : '';

    const components = buildSendComponents(templateDef, mediaUrls);

    const sentAt = new Date().toISOString();
    try {
      const res = await sendWithRetry({ to: TO, name, language, components });
      if (!res.ok) throw res.err;
      const resp = res.resp;
      report.sent++;
      fs.appendFileSync(
        OUTPUT_CSV,
        [
          csvEscape(name),
          csvEscape(templateDef.category || ''),
          csvEscape(language),
          csvEscape(headerFormat),
          csvEscape(sentAt),
          csvEscape('SENT'),
          csvEscape(JSON.stringify(resp.data || {})),
          csvEscape(''),
          csvEscape(mediaUrls.IMAGE),
          csvEscape(mediaUrls.VIDEO),
          csvEscape(mediaUrls.DOCUMENT),
        ].join(',') + '\n'
      );
    } catch (err) {
      report.failed++;
      const apiError = err && err.response && err.response.error ? err.response.error : null;
      const msg = apiError ? JSON.stringify(apiError) : String(err && err.message ? err.message : err);
      fs.appendFileSync(
        OUTPUT_CSV,
        [
          csvEscape(name),
          csvEscape(templateDef.category || ''),
          csvEscape(language),
          csvEscape(headerFormat),
          csvEscape(sentAt),
          csvEscape('FAILED'),
          csvEscape(''),
          csvEscape(msg),
          csvEscape(mediaUrls.IMAGE),
          csvEscape(mediaUrls.VIDEO),
          csvEscape(mediaUrls.DOCUMENT),
        ].join(',') + '\n'
      );
    }

    await sleep(2000);
  }

  console.log('[send] Done:', report);
  console.log('[send] Report CSV:', OUTPUT_CSV);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
