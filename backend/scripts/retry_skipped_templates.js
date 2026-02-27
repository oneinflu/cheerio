const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');
const cloudinaryLib = require('cloudinary').v2;

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;
const GRAPH_BASE = process.env.WHATSAPP_GRAPH_BASE || 'https://graph.facebook.com/v21.0';
const TO = '919182151640'; // Target phone number

const INPUT_CSV = path.join(__dirname, 'template_send_skipped_57.csv');
const OUTPUT_CSV = path.join(__dirname, 'template_retry_report.csv');

// Media Paths (same as before)
const MEDIA_FILES = {
  IMAGE: path.join(__dirname, '../files/image.png'),
  VIDEO: path.join(__dirname, '../files/video.mp4'),
  DOCUMENT: path.join(__dirname, '../files/document.pdf'),
};

// Cloudinary Config
cloudinaryLib.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CSV Parsing Logic
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

function csvEscape(field) {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
}

// Cloudinary Upload
async function uploadToCloudinary(kind) {
  const filePath = MEDIA_FILES[kind];
  if (!fs.existsSync(filePath)) throw new Error(`Missing media file: ${filePath}`);

  const folder = process.env.CLOUDINARY_FOLDER || 'whatsapp-template-qa';
  const publicId = `template-qa-${kind.toLowerCase()}-${Date.now()}`;

  const options = {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: kind === 'IMAGE' ? 'image' : (kind === 'VIDEO' ? 'video' : 'raw')
  };

  console.log(`Uploading ${kind} to Cloudinary...`);
  const res = await cloudinaryLib.uploader.upload(filePath, options);
  return res.secure_url;
}

// Fetch Template Details
async function getTemplateByName(name) {
  try {
    const url = `${GRAPH_BASE}/${WABA_ID}/message_templates`;
    const res = await axios.get(url, {
      params: { name, limit: 1 },
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    if (res.data && res.data.data && res.data.data.length > 0) {
      return res.data.data[0];
    }
    return null;
  } catch (err) {
    console.error(`Error fetching template ${name}:`, err.message);
    return null;
  }
}

// Send Template
async function sendTemplate(to, templateName, languageCode, components) {
  const url = `${GRAPH_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components || []
    }
  };

  try {
    const res = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return { success: true, data: res.data };
  } catch (err) {
    return { 
      success: false, 
      error: err.response ? JSON.stringify(err.response.data) : err.message 
    };
  }
}

// Payload Construction Helpers
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

  // Helper to extract button metadata
  const buttons = getButtonMeta(comps);

  for (const { button, index } of buttons) {
    if (!button || !button.type) continue;

    // Handle standard COPY_CODE (Coupon)
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

    // Handle URL buttons with variables
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

  // Handle AUTHENTICATION specific buttons (OTP)
  if (String(templateDef.category).toUpperCase() === 'AUTHENTICATION') {
    // Find index of button with otp_type
    // Note: getButtonMeta returns mapped array, we need original index logic
    // But for Auth, buttons are usually single or specific.
    // The previous script used:
    // const otpButtonIndex = buttons.findIndex((b) => b && b.button && b.button.otp_type);
    
    // Check if any button has otp_type
    const otpButtonEntry = buttons.find(({ button }) => button && button.otp_type);
    if (otpButtonEntry) {
       out.push({
        type: 'button',
        sub_type: 'url',
        index: otpButtonEntry.index,
        parameters: [{ type: 'text', text: '123456' }],
      });
    }
  }

  return out;
}


// ------------------------------------------------------------------
// Main Logic
// ------------------------------------------------------------------

async function main() {
  if (!WABA_ID || !TOKEN) throw new Error('Missing WABA_ID or WHATSAPP_TOKEN');

  // 1. Upload Media
  const mediaUrls = {
    IMAGE: await uploadToCloudinary('IMAGE'),
    VIDEO: await uploadToCloudinary('VIDEO'),
    DOCUMENT: await uploadToCloudinary('DOCUMENT'),
  };
  console.log('Media uploaded:', mediaUrls);

  // 2. Read Skipped CSV
  const skippedTemplates = [];
  const fileStream = fs.createReadStream(INPUT_CSV);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  let header = null;
  let nameIndex = -1;

  for await (const line of rl) {
    const cols = parseCsvLine(line);
    if (!header) {
      header = cols;
      nameIndex = cols.findIndex(c => c === 'TemplateName');
      continue;
    }
    if (nameIndex !== -1 && cols[nameIndex]) {
      skippedTemplates.push(cols[nameIndex]);
    }
  }

  console.log(`Loaded ${skippedTemplates.length} templates to retry.`);

  // 3. Prepare Output
  const outputStream = fs.createWriteStream(OUTPUT_CSV);
  outputStream.write('TemplateName,Status,SendResult,Error\n');

  // 4. Process Each
  for (const name of skippedTemplates) {
    console.log(`Processing: ${name}`);
    
    // Fetch details
    const templateDef = await getTemplateByName(name);
    
    if (!templateDef) {
      console.log(`  -> Not Found in WABA`);
      outputStream.write(`${csvEscape(name)},NOT_FOUND,SKIPPED,Template not found\n`);
      continue;
    }

    if (templateDef.status !== 'APPROVED') {
      console.log(`  -> Status: ${templateDef.status}`);
      outputStream.write(`${csvEscape(name)},${templateDef.status},SKIPPED,Not approved\n`);
      continue;
    }

    // Construct Payload
    const components = buildSendComponents(templateDef, mediaUrls);
    const language = templateDef.language || 'en_US'; // Fallback

    // Send
    console.log(`  -> Sending (lang: ${language})...`);
    const sendRes = await sendTemplate(TO, name, language, components);

    if (sendRes.success) {
      console.log(`  -> SENT!`);
      outputStream.write(`${csvEscape(name)},APPROVED,SENT,\n`);
    } else {
      console.error(`  -> FAILED: ${sendRes.error}`);
      outputStream.write(`${csvEscape(name)},APPROVED,FAILED,${csvEscape(sendRes.error)}\n`);
    }

    // Rate Limit
    await delay(200);
  }

  outputStream.end();
  console.log(`Retry complete. Report saved to ${OUTPUT_CSV}`);
}

main().catch(console.error);
