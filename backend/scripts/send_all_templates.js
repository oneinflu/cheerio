const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const whatsappClient = require('../src/integrations/meta/whatsappClient');
const cloudinaryLib = require('cloudinary').v2;

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isCloudinaryConfigured() {
  return (
    !!process.env.CLOUDINARY_CLOUD_NAME &&
    !!process.env.CLOUDINARY_API_KEY &&
    !!process.env.CLOUDINARY_API_SECRET
  );
}

async function uploadToCloudinary(localPath) {
  if (!fs.existsSync(localPath)) throw new Error(`File not found: ${localPath}`);
  const res = await cloudinaryLib.uploader.upload(localPath, {
    resource_type: 'auto',
    folder: 'whatsapp-template-test',
    overwrite: false,
  });
  if (!res || !res.secure_url) throw new Error('Cloudinary upload did not return a secure_url');
  return res.secure_url;
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function extractPlaceholders(text) {
  const out = [];
  if (!text) return out;
  const re = /{{\s*([^}]+)\s*}}/g;
  let m;
  while ((m = re.exec(String(text))) !== null) {
    const key = String(m[1] || '').trim();
    if (!key) continue;
    out.push(key);
  }
  return out;
}

function buildBodyParameters(tmpl) {
  const bodyComp = (tmpl.components || []).find((c) => c.type === 'BODY');
  const fmt = String(tmpl.parameter_format || 'POSITIONAL').toUpperCase();
  const bodyText = bodyComp && bodyComp.text ? String(bodyComp.text) : '';
  const keys = extractPlaceholders(bodyText);
  const example = bodyComp && bodyComp.example ? bodyComp.example : null;

  if (fmt === 'NAMED' && example && Array.isArray(example.body_text_named_params)) {
    return example.body_text_named_params.map((p) => ({
      type: 'text',
      parameter_name: p.param_name,
      text: (Array.isArray(p.example) ? p.example[0] : p.example) || 'test',
    }));
  }

  const exampleArr =
    example && Array.isArray(example.body_text) && Array.isArray(example.body_text[0]) ? example.body_text[0] : null;
  if (exampleArr && exampleArr.length > 0) {
    return exampleArr.map((val) => ({ type: 'text', text: String(val ?? 'test') }));
  }

  if (fmt === 'NAMED') {
    return keys.map((k, i) => ({
      type: 'text',
      parameter_name: k,
      text: `test${i + 1}`,
    }));
  }

  return keys.map((_, i) => ({ type: 'text', text: `test${i + 1}` }));
}

function buildHeaderComponent(tmpl, mediaLinks) {
  const headerComp = (tmpl.components || []).find((c) => c.type === 'HEADER');
  if (!headerComp) return null;
  const format = headerComp.format ? String(headerComp.format).toUpperCase() : 'NONE';
  const fmt = String(tmpl.parameter_format || 'POSITIONAL').toUpperCase();

  if (format === 'IMAGE') {
    const link = mediaLinks.IMAGE;
    if (!link) return null;
    return { type: 'header', parameters: [{ type: 'image', image: { link } }] };
  }
  if (format === 'VIDEO') {
    const link = mediaLinks.VIDEO;
    if (!link) return null;
    return { type: 'header', parameters: [{ type: 'video', video: { link } }] };
  }
  if (format === 'DOCUMENT') {
    const link = mediaLinks.DOCUMENT;
    if (!link) return null;
    return { type: 'header', parameters: [{ type: 'document', document: { link } }] };
  }
  if (format === 'TEXT') {
    const keys = extractPlaceholders(headerComp.text || '');
    if (keys.length === 0) return null;
    if (fmt === 'NAMED') {
      return {
        type: 'header',
        parameters: keys.map((k, i) => ({ type: 'text', parameter_name: k, text: `test${i + 1}` })),
      };
    }
    return { type: 'header', parameters: keys.map((_, i) => ({ type: 'text', text: `test${i + 1}` })) };
  }
  return null;
}

function buildButtonsComponents(tmpl) {
  const buttonsComp = (tmpl.components || []).find((c) => c.type === 'BUTTONS');
  if (!buttonsComp || !Array.isArray(buttonsComp.buttons) || buttonsComp.buttons.length === 0) return [];

  const out = [];
  buttonsComp.buttons.forEach((b, idx) => {
    const type = b && b.type ? String(b.type).toUpperCase() : '';
    if (type === 'URL') {
      const url = String(b.url || '');
      const keys = extractPlaceholders(url);
      if (keys.length === 0) return;
      out.push({
        type: 'button',
        sub_type: 'url',
        index: String(idx),
        parameters: keys.map((_, i) => ({ type: 'text', text: `track${i + 1}` })),
      });
      return;
    }
    if (type === 'COPY_CODE') {
      out.push({
        type: 'button',
        sub_type: 'copy_code',
        index: String(idx),
        parameters: [{ type: 'coupon_code', coupon_code: 'TESTCODE' }],
      });
      return;
    }
  });
  return out;
}

async function buildMediaLinks() {
  const direct = {
    IMAGE: process.env.TEMPLATE_TEST_IMAGE_URL || null,
    VIDEO: process.env.TEMPLATE_TEST_VIDEO_URL || null,
    DOCUMENT: process.env.TEMPLATE_TEST_DOCUMENT_URL || null,
  };

  if (direct.IMAGE && direct.VIDEO && direct.DOCUMENT) return direct;

  if (!isCloudinaryConfigured()) return direct;

  cloudinaryLib.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const imagePath = process.env.TEMPLATE_TEST_IMAGE_PATH || path.join(__dirname, '..', 'files', 'image.png');
  const videoPath = process.env.TEMPLATE_TEST_VIDEO_PATH || path.join(__dirname, '..', 'files', 'video.mp4');
  const docPath = process.env.TEMPLATE_TEST_DOCUMENT_PATH || path.join(__dirname, '..', 'files', 'document.pdf');

  const out = { ...direct };
  if (!out.IMAGE) out.IMAGE = await uploadToCloudinary(imagePath);
  if (!out.VIDEO) out.VIDEO = await uploadToCloudinary(videoPath);
  if (!out.DOCUMENT) out.DOCUMENT = await uploadToCloudinary(docPath);
  return out;
}

async function run() {
  const to = String(process.argv[2] || process.env.TEST_PHONE_NUMBER || '919182151640').replace(/[^0-9]/g, '');
  const onlyApproved = String(process.env.ONLY_APPROVED || 'true').toLowerCase() !== 'false';
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : null;
  const filter = process.env.FILTER ? String(process.env.FILTER) : '';
  const delayMs = process.env.DELAY_MS ? Number(process.env.DELAY_MS) : 1200;

  if (!WABA_ID) throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not configured');
  if (!PHONE_NUMBER_ID) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured');
  if (!to) throw new Error('Recipient number is required (digits only)');

  const mediaLinks = await buildMediaLinks();
  console.log('[templates:test] Using recipient:', to);
  console.log('[templates:test] Media links:', mediaLinks);

  const res = await whatsappClient.getTemplates(WABA_ID, 250);
  const rawTemplates = res && res.data && Array.isArray(res.data.data) ? res.data.data : [];
  const templates = uniqueBy(rawTemplates, (t) => `${t.name}:${t.language}`);
  const selected = templates
    .filter((t) => (onlyApproved ? t.status === 'APPROVED' : true))
    .filter((t) => (filter ? String(t.name).includes(filter) : true))
    .slice(0, limit ? Math.max(0, limit) : templates.length);

  console.log('[templates:test] Total templates:', templates.length);
  console.log('[templates:test] Selected templates:', selected.length);

  const results = [];
  for (let i = 0; i < selected.length; i++) {
    const t = selected[i];
    const header = buildHeaderComponent(t, mediaLinks);
    const bodyParams = buildBodyParameters(t);
    const buttons = buildButtonsComponents(t);

    const components = [];
    if (header) components.push(header);
    if (bodyParams && bodyParams.length > 0) components.push({ type: 'body', parameters: bodyParams });
    components.push(...buttons);

    const name = t.name;
    const languageCode = t.language || 'en_US';

    try {
      console.log(`[templates:test] (${i + 1}/${selected.length}) Sending: ${name} (${languageCode})`);
      const sendRes = await whatsappClient.sendTemplate(PHONE_NUMBER_ID, to, name, languageCode, components);
      const messageId =
        sendRes && sendRes.data && Array.isArray(sendRes.data.messages) && sendRes.data.messages[0]
          ? sendRes.data.messages[0].id
          : null;
      console.log(`[templates:test] OK: ${name} -> ${messageId || 'no_wamid'}`);
      results.push({ name, language: languageCode, ok: true, wamid: messageId });
    } catch (err) {
      console.error(`[templates:test] FAIL: ${name} (${languageCode}) -> ${err.message}`);
      if (err.response) console.error(JSON.stringify(err.response, null, 2));
      results.push({ name, language: languageCode, ok: false, error: err.message, response: err.response || null });
    }

    if (i < selected.length - 1) await sleep(delayMs);
  }

  const outPath = path.join(__dirname, 'template_send_all_results.json');
  fs.writeFileSync(outPath, JSON.stringify({ to, results, at: new Date().toISOString() }, null, 2));
  console.log('[templates:test] Done. Results written to:', outPath);
}

run().catch((e) => {
  console.error('[templates:test] Fatal:', e.message);
  process.exitCode = 1;
});

