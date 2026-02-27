'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const whatsappClient = require('../src/integrations/meta/whatsappClient');
const axios = require('axios');
const cloudinaryLib = require('cloudinary').v2;

// Configuration
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const CSV_FILE = path.join(__dirname, 'template_retry_report_updated.csv');
const TO = '919182151640';

// Cloudinary Config
cloudinaryLib.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Media Paths
const MEDIA_FILES = {
  IMAGE: path.join(__dirname, '../files/image.png'),
  VIDEO: path.join(__dirname, '../files/video.mp4'),
  DOCUMENT: path.join(__dirname, '../files/document.pdf'),
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function csvEscape(field) {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
}

async function uploadMedia(type) {
  // Not used anymore for sending, but kept for reference if needed for creation
  // We'll use Cloudinary for sending
  return null;
}

async function uploadToCloudinary(kind) {
  const filePath = MEDIA_FILES[kind];
  if (!fs.existsSync(filePath)) {
    console.warn(`[QA] Media file not found: ${filePath}`);
    return null;
  }
  
  const folder = process.env.CLOUDINARY_FOLDER || 'whatsapp-template-qa';
  const publicId = `template-qa-${kind.toLowerCase()}-${Date.now()}`;
  
  try {
    const res = await cloudinaryLib.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      resource_type: kind === 'IMAGE' ? 'image' : (kind === 'VIDEO' ? 'video' : 'raw'),
      overwrite: true,
    });
    return res.secure_url;
  } catch (err) {
    console.error(`[QA] Failed to upload ${kind} to Cloudinary:`, err.message);
    return null;
  }
}

async function getTemplateStatus(name) {
    try {
        // Since we can't efficiently filter by name in list endpoint (unless using 'name' param which works for single)
        // Let's try getting by name directly?
        // The API supports ?name=xxx&limit=1
        const url = `${process.env.WHATSAPP_GRAPH_BASE || 'https://graph.facebook.com/v21.0'}/${WABA_ID}/message_templates?name=${name}&limit=1`;
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` }
        });
        const list = res.data?.data || [];
        if (list.length > 0) return list[0];
        return null;
    } catch (e) {
        console.error(`Error fetching template ${name}:`, e.message);
        return null;
    }
}

function buildSendComponents(name, mediaUrls) {
    const out = [];
    
    // Parse Name to deduce components
    const parts = name.split('_');
    const category = parts[0].toUpperCase();
    const headerType = parts[1].toUpperCase();
    
    // Determine buttons and vars from name keywords
    const hasVars = name.includes('_vars_') && !name.includes('_novars_');
    const hasCtaQr = name.includes('_cta_qr_');
    const hasCta = name.includes('_cta_') && !hasCtaQr;
    const hasQr = name.includes('_quick_reply_');
    const isCoupon = name.includes('_coupon_');

    // Header
    if (headerType === 'TEXT' && hasVars) {
        out.push({ type: 'header', parameters: [{ type: 'text', text: 'John' }] });
    } else if (headerType !== 'NONE' && headerType !== 'TEXT') {
        const typeLower = headerType.toLowerCase();
        out.push({ type: 'header', parameters: [{ type: typeLower, [typeLower]: { link: mediaUrls[headerType] } }] });
    }

    // Body
    if (hasVars) {
        if (category === 'AUTHENTICATION') {
            out.push({ type: 'body', parameters: [{ type: 'text', text: '123456' }] });
        } else if (category === 'UTILITY') {
            out.push({ type: 'body', parameters: [
                { type: 'text', text: 'John' },
                { type: 'text', text: '#123' },
                { type: 'text', text: 'REF123' }
            ]});
        } else {
            out.push({ type: 'body', parameters: [
                { type: 'text', text: 'John' },
                { type: 'text', text: '20' },
                { type: 'text', text: 'WELCOME20' }
            ]});
        }
    }

    // Button
    if (isCoupon) {
        let index = 0;
        if (hasCtaQr) index = 2; // QR(0), QR(1), CTA(2)
        
        out.push({ 
            type: 'button', 
            sub_type: 'COPY_CODE', 
            index, 
            parameters: [{ type: 'coupon_code', coupon_code: 'WELCOME20' }] 
        });
    }

    return out;
}

// ------------------------------------------------------------------
// Main Logic
// ------------------------------------------------------------------

async function main() {
  if (!WABA_ID) throw new Error('Missing WABA_ID');

  // 1. Upload Media (Cloudinary)
  const mediaUrls = {
    IMAGE: await uploadToCloudinary('IMAGE'),
    VIDEO: await uploadToCloudinary('VIDEO'),
    DOCUMENT: await uploadToCloudinary('DOCUMENT'),
  };

  // 2. Read Report
  console.log('Reading report...');
  const rows = [];
  const fileStream = fs.createReadStream(CSV_FILE);
  const rl = require('readline').createInterface({ input: fileStream, crlfDelay: Infinity });

  let header = null;
  for await (const line of rl) {
    const cols = parseCsvLine(line);
    if (!header) {
      header = cols;
      continue;
    }
    rows.push(cols);
  }

  // 3. Process Rows
  let updatedCount = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0];
    const status = row[1]; // Status
    const result = row[2]; // SendResult
    
    // Check if we need to act
    const isPending = status === 'PENDING';
    const isFailedSend = result === 'FAILED';

    if (!isPending && !isFailedSend) continue;

    console.log(`Checking: ${name} (Status: ${status}, Send: ${result})`);

    // Case 1: PENDING -> Check Status
    if (isPending) {
        const t = await getTemplateStatus(name);
        if (t) {
            row[1] = t.status; // Update status
            console.log(`  -> New Status: ${t.status}`);
            
            if (t.status === 'APPROVED') {
                // Try sending
                try {
                    const comps = buildSendComponents(name, mediaUrls);
                    await whatsappClient.sendTemplate(process.env.WHATSAPP_PHONE_NUMBER_ID, TO, name, 'en_US', comps);
                    console.log('  -> SENT!');
                    row[2] = 'SENT';
                    row[3] = '';
                } catch (err) {
                    console.error('  -> Send Failed:', err.message);
                    row[2] = 'FAILED';
                    row[3] = err.message;
                }
            } else if (t.status === 'REJECTED') {
                row[2] = 'SKIPPED';
                row[3] = 'Rejected by Meta';
            }
            updatedCount++;
        } else {
            console.log('  -> Not found / Error fetching');
        }
    }
    // Case 2: FAILED Send (e.g. invalid parameter) -> Retry Send
    else if (isFailedSend && status === 'APPROVED') {
        console.log('  -> Retrying Send...');
        try {
            const comps = buildSendComponents(name, mediaUrls);
            await whatsappClient.sendTemplate(process.env.WHATSAPP_PHONE_NUMBER_ID, TO, name, 'en_US', comps);
            console.log('  -> SENT!');
            row[2] = 'SENT';
            row[3] = '';
        } catch (err) {
            console.error('  -> Retry Failed:', err.message);
            row[3] = err.message;
        }
        updatedCount++;
    }

    await delay(1000); // Rate limit
  }

  // 4. Write Output
  if (updatedCount > 0) {
      const writeStream = fs.createWriteStream(CSV_FILE);
      writeStream.write('TemplateName,Status,SendResult,Error\n');
      for (const row of rows) {
        writeStream.write(row.map(csvEscape).join(',') + '\n');
      }
      writeStream.end();
      console.log(`Updated ${updatedCount} rows in ${CSV_FILE}`);
  } else {
      console.log('No updates needed.');
  }
}

main().catch(console.error);
