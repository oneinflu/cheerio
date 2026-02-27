'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const whatsappClient = require('../src/integrations/meta/whatsappClient');
const axios = require('axios');

// Configuration
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const INPUT_FILE = path.join(__dirname, 'template_retry_report.csv');
const OUTPUT_FILE = path.join(__dirname, 'template_retry_report_updated.csv');
const TO = '919182151640';

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
  const filePath = MEDIA_FILES[type];
  if (!fs.existsSync(filePath)) {
    console.warn(`[QA] Media file not found: ${filePath}`);
    return null;
  }
  
  console.log(`[QA] Uploading ${type} media handle...`);
  const buffer = fs.readFileSync(filePath);
  const mimeType = type === 'IMAGE' ? 'image/png' : type === 'VIDEO' ? 'video/mp4' : 'application/pdf';
  const filename = path.basename(filePath);
  
  try {
    const res = await whatsappClient.uploadMessageTemplateMedia(WABA_ID, buffer, mimeType, filename);
    return res.h;
  } catch (err) {
    console.error(`[QA] Failed to upload ${type}:`, err.message);
    return null;
  }
}

// ------------------------------------------------------------------
// Content Generators (Modified for better approval odds)
// ------------------------------------------------------------------

function generateContent(category, hasVariables) {
  if (category === 'AUTHENTICATION') {
    return hasVariables 
      ? 'Your verification code is {{1}}. Do not share it with anyone.' 
      : 'Your verification code is 123456. Do not share it with anyone.';
  }
  if (category === 'UTILITY') {
    return hasVariables
      ? 'Hello {{1}}, your order {{2}} has been confirmed. Your reference ID is {{3}}.'
      : 'Hello customer, your order #12345 has been confirmed. Thank you.';
  }
  // Marketing - Slightly tweaked
  return hasVariables
    ? 'Hi {{1}}, we have a special {{2}}% discount waiting for you. Use code {{3}} at checkout.'
    : 'Hi there, we have a special 20% discount waiting for you. Use code WELCOME20 at checkout.';
}

function getExample(category, hasVariables, headerType, mediaHandle) {
  if (!hasVariables && headerType === 'NONE') return undefined;
  if (!hasVariables && headerType === 'TEXT') return undefined;

  const example = {};
  
  // Header Example
  if (headerType === 'IMAGE' && mediaHandle) example.header_handle = [mediaHandle];
  if (headerType === 'VIDEO' && mediaHandle) example.header_handle = [mediaHandle];
  if (headerType === 'DOCUMENT' && mediaHandle) example.header_handle = [mediaHandle];
  if (headerType === 'TEXT' && hasVariables) example.header_text = ['John'];

  // Body Example
  if (hasVariables) {
    if (category === 'AUTHENTICATION') example.body_text = [['123456']];
    else if (category === 'UTILITY') example.body_text = [['John', '#123', 'REF123']];
    else example.body_text = [['John', '20', 'WELCOME20']];
  }

  return example;
}

// ------------------------------------------------------------------
// Main Logic
// ------------------------------------------------------------------

async function main() {
  if (!WABA_ID) throw new Error('Missing WABA_ID');

  // 1. Upload Media Handles
  const handles = {
    IMAGE: await uploadMedia('IMAGE'),
    VIDEO: await uploadMedia('VIDEO'),
    DOCUMENT: await uploadMedia('DOCUMENT'),
  };

  // 2. Read Report
  console.log('Reading report...');
  const rows = [];
  const fileStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

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
  const newRows = [];
  
  for (const row of rows) {
    const name = row[0];
    const status = row[1];
    
    // Only process REJECTED templates
    if (status !== 'REJECTED') {
      newRows.push(row);
      continue;
    }

    console.log(`\nRe-creating rejected template: ${name}`);

    // Parse Name: category_header_buttons_footer_purpose_vars_timestamp
    // Example: marketing_text_cta_footer_promo_vars_1327
    const parts = name.split('_');
    const category = parts[0].toUpperCase();
    const headerType = parts[1].toUpperCase();
    // Buttons might be 'quick_reply' (2 parts) or 'cta' (1 part) or 'none'
    // This parsing is fragile. Better to deduce from known structure.
    // Structure: cat_header_btn_footer_purpose_vars_ts
    // marketing(0) text(1) cta(2) footer(3) promo(4) vars(5) 1327(6)
    // marketing(0) text(1) quick(2) reply(3) footer(4) promo(5) vars(6) ...
    
    // Let's rely on finding keywords
    const hasFooter = name.includes('_footer_') && !name.includes('_nofooter_');
    const hasVars = name.includes('_vars_') && !name.includes('_novars_');
    
    let btnType = 'NONE';
    if (name.includes('_quick_reply_')) btnType = 'QUICK_REPLY';
    else if (name.includes('_cta_qr_')) btnType = 'BOTH';
    else if (name.includes('_cta_')) btnType = 'CTA';
    
    // CTA Type deduction
    let ctaType = 'NONE';
    if (btnType !== 'NONE') {
        // We don't strictly need the exact CTA type from the name if we just default to standard valid ones
        if (name.includes('_coupon_')) ctaType = 'COPY_COUPON';
        else ctaType = 'VISIT_WEBSITE'; // Default for promo
    }

    // Generate New Name
    const timestamp = Date.now().toString().slice(-4);
    const newName = name.replace(/_\d+$/, `_${timestamp}`);
    
    // Construct Components
    const components = [];
    
    // Header
    if (headerType !== 'NONE') {
      const headerComp = { type: 'HEADER', format: headerType };
      if (headerType === 'TEXT') {
        headerComp.text = hasVars ? 'Welcome {{1}}' : 'Welcome to our service'; // Re-use simpler header
        if (hasVars) headerComp.example = { header_text: ['John'] };
      } else {
        if (handles[headerType]) {
           headerComp.example = { header_handle: [handles[headerType]] };
        }
      }
      components.push(headerComp);
    }

    // Body
    const bodyText = generateContent(category, hasVars);
    const bodyComp = { type: 'BODY', text: bodyText };
    if (hasVars) {
       const example = getExample(category, hasVars, headerType, handles[headerType]);
       if (example && example.body_text) bodyComp.example = { body_text: example.body_text };
    }
    components.push(bodyComp);

    // Footer
    if (hasFooter) {
      components.push({ type: 'FOOTER', text: 'Powered by QA Automation' });
    }

    // Buttons
    if (btnType !== 'NONE') {
      const btns = [];
      if (btnType === 'QUICK_REPLY' || btnType === 'BOTH') {
        btns.push({ type: 'QUICK_REPLY', text: 'Yes' });
        btns.push({ type: 'QUICK_REPLY', text: 'No' });
      }
      if (btnType === 'CTA' || btnType === 'BOTH') {
        if (ctaType === 'COPY_COUPON') {
           btns.push({ type: 'COPY_CODE', example: 'WELCOME20' });
        } else {
           btns.push({ type: 'URL', text: 'Visit Website', url: 'https://example.com' });
        }
      }
      if (btns.length > 0) {
        components.push({ type: 'BUTTONS', buttons: btns });
      }
    }

    // Create Payload
    const payload = {
      name: newName,
      category,
      components,
      language: 'en_US',
    };

    try {
      console.log(`  Creating: ${newName}`);
      await whatsappClient.createTemplate(WABA_ID, payload);
      
      // Poll for Approval
      console.log('  Waiting for approval...');
      let finalStatus = 'PENDING';
      for (let i = 0; i < 12; i++) { // 12 * 5s = 60s max
        await delay(5000);
        const t = await getTemplateStatus(newName);
        if (t && t.status !== 'PENDING' && t.status !== 'IN_APPEAL') {
          finalStatus = t.status;
          break;
        }
        process.stdout.write('.');
      }
      console.log(`\n  Final Status: ${finalStatus}`);

      if (finalStatus === 'APPROVED') {
        // Send
        console.log('  Sending...');
        // We need to construct send components similar to the other script
        // For simplicity, we'll use a simplified send logic here since we know the structure
        const sendComps = buildSendComponents(category, headerType, hasVars, btnType, ctaType, handles);
        
        try {
           // We need to use the whatsappClient or axios directly. 
           // The whatsappClient.sendTemplate function in src/integrations... uses `sendTemplate`
           // But we need to import it or use axios.
           // We'll use axios here for self-containment or require the client.
           // We already required whatsappClient.
           
           // But wait, whatsappClient.sendTemplate expects components.
           // Let's define buildSendComponents.
           await whatsappClient.sendTemplate(process.env.WHATSAPP_PHONE_NUMBER_ID, TO, newName, 'en_US', sendComps);
           console.log('  SENT!');
           
           // Update Row
           newRows.push([newName, 'APPROVED', 'SENT', '']);
        } catch (sendErr) {
           console.error('  Send Failed:', sendErr.message);
           newRows.push([newName, 'APPROVED', 'FAILED', sendErr.message]);
        }
      } else {
        newRows.push([newName, finalStatus, 'SKIPPED', 'Not Approved']);
      }

    } catch (err) {
      console.error('  Creation Failed:', err.response ? err.response.data : err.message);
      newRows.push([newName, 'CREATION_FAILED', 'SKIPPED', err.message]);
    }
  }

  // 4. Write Output
  const writeStream = fs.createWriteStream(OUTPUT_FILE);
  writeStream.write('TemplateName,Status,SendResult,Error\n');
  for (const row of newRows) {
    writeStream.write(row.map(csvEscape).join(',') + '\n');
  }
  writeStream.end();
  console.log(`Done. Updated report at ${OUTPUT_FILE}`);
}

async function getTemplateStatus(name) {
    try {
        const res = await whatsappClient.getTemplates(WABA_ID, 200); // Inefficient but simple
        // Better to search by name if possible, but graph api list has limit.
        // Actually we can filter by name in code.
        const list = res.data?.data || [];
        return list.find(t => t.name === name);
    } catch (e) {
        return null;
    }
}

function buildSendComponents(category, headerType, hasVars, btnType, ctaType, handles) {
    const out = [];
    
    // Header
    if (headerType === 'TEXT' && hasVars) {
        out.push({ type: 'header', parameters: [{ type: 'text', text: 'John' }] });
    } else if (headerType !== 'NONE' && headerType !== 'TEXT') {
        const typeLower = headerType.toLowerCase();
        // We need public URLs for sending, NOT handles. 
        // Oh right, sending requires URLs (link) or IDs. 
        // The `uploadMedia` returned handles (h). 
        // Sending supports ID? Yes, `id` in media object.
        // Let's use the handle as ID.
        out.push({ type: 'header', parameters: [{ type: typeLower, [typeLower]: { id: handles[headerType] } }] });
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
    if (ctaType === 'COPY_COUPON') {
        out.push({ 
            type: 'button', 
            sub_type: 'COPY_CODE', 
            index: 0, 
            parameters: [{ type: 'coupon_code', coupon_code: 'WELCOME20' }] 
        });
    }

    return out;
}

const readline = require('readline');
main().catch(console.error);
