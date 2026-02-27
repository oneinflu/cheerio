'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const whatsappClient = require('../src/integrations/meta/whatsappClient');

// Configuration
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const CSV_FILE = path.join(__dirname, 'template_qa_results.csv');
const REPORT_FILE = path.join(__dirname, 'template_qa_report.txt');

// Media Paths
const MEDIA_FILES = {
  IMAGE: path.join(__dirname, '../files/image.png'),
  VIDEO: path.join(__dirname, '../files/video.mp4'),
  DOCUMENT: path.join(__dirname, '../files/document.pdf'),
};

// Global State
const stats = {
  total: 0,
  valid: 0,
  approved: 0,
  rejected: 0,
  pending: 0,
  byCategory: {
    MARKETING: { total: 0, approved: 0, rejected: 0 },
    UTILITY: { total: 0, approved: 0, rejected: 0 },
    AUTHENTICATION: { total: 0, approved: 0, rejected: 0 },
  },
  reasons: {},
};

const results = [];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function logResult(row) {
  results.push(row);
  const csvRow = [
    row.name, row.category, row.header, row.media, row.footer, row.buttons, row.ctaType,
    row.variables, row.status, row.metaError || '', row.fixApplied || '', row.finalResult,
    row.description || '', row.variablesUsed || '', row.dosDonts || ''
  ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',');
  
  fs.appendFileSync(CSV_FILE, csvRow + '\n');
}

async function uploadMedia(type) {
  const filePath = MEDIA_FILES[type];
  if (!fs.existsSync(filePath)) {
    console.warn(`[QA] Media file not found: ${filePath}`);
    return null;
  }
  
  console.log(`[QA] Uploading ${type} media...`);
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

// ─────────────────────────────────────────────
// Generators
// ─────────────────────────────────────────────

function generateContent(category, hasVariables) {
  if (category === 'AUTHENTICATION') {
    return hasVariables 
      ? 'Your verification code is {{1}}. Do not share it with anyone.' 
      : 'Your verification code is 123456. Do not share it with anyone.';
  }
  if (category === 'UTILITY') {
    return hasVariables
      ? 'Hello {{1}}, your order {{2}} has been shipped. Your tracking ID is {{3}} for reference.'
      : 'Hello customer, your order #12345 has been shipped. Track it online.';
  }
  // Marketing
  return hasVariables
    ? 'Hi {{1}}, enjoy {{2}}% off on your next purchase. Use code {{3}} today.'
    : 'Hi there, enjoy 20% off on your next purchase. Use code WELCOME20 today.';
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
    else if (category === 'UTILITY') example.body_text = [['John', '#123', 'TRK123456']];
    else example.body_text = [['John', '20', 'WELCOME20']];
  }

  return example;
}

function getNamedExample(category, hasVariables, headerType, mediaHandle) {
  if (!hasVariables && headerType === 'NONE') return undefined;
  if (!hasVariables && headerType === 'TEXT') return undefined;

  const example = {};
  
  // Header Example (remains same for named)
  if (headerType === 'IMAGE' && mediaHandle) example.header_handle = [mediaHandle];
  if (headerType === 'VIDEO' && mediaHandle) example.header_handle = [mediaHandle];
  if (headerType === 'DOCUMENT' && mediaHandle) example.header_handle = [mediaHandle];
  if (headerType === 'TEXT' && hasVariables) example.header_text = ['John'];

  // Body Example (Named)
  if (hasVariables) {
    // Note: Meta named param format is usually not supported in 'create' via standard API easily, 
    // it depends on how parameter_format is set. 
    // If we use NAMED, body_text needs to be object.
    // However, usually named params are: "Hi {{name}}, ..."
    // Let's assume standard positional unless we change content.
    // If the user wants named parameters retry, we need to change the content structure too.
    
    // BUT, simply switching the EXAMPLE format to named might be what is needed if the template
    // content implies it. 
    // Standard creation uses {{1}}, {{2}} which are positional. 
    // If we want named, we must use {{name}}, {{offer}} in content.
    
    if (category === 'AUTHENTICATION') {
       example.body_text_named_params = [{ param_name: 'code', example: '123456' }];
    } else if (category === 'UTILITY') {
       example.body_text_named_params = [
         { param_name: 'name', example: 'John' },
         { param_name: 'order_id', example: '#123' },
         { param_name: 'tracking_id', example: 'TRK123456' }
       ];
    } else {
       example.body_text_named_params = [
         { param_name: 'name', example: 'John' },
         { param_name: 'discount', example: '20' },
         { param_name: 'code', example: 'WELCOME20' }
       ];
    }
  }

  return example;
}

function generateNamedContent(category, hasVariables) {
  if (category === 'AUTHENTICATION') {
    return hasVariables 
      ? 'Your verification code is {{code}}. Do not share it with anyone.' 
      : 'Your verification code is 123456. Do not share it with anyone.';
  }
  if (category === 'UTILITY') {
    return hasVariables
      ? 'Hello {{name}}, your order {{order_id}} has been shipped. Your tracking ID is {{tracking_id}} for reference.'
      : 'Hello customer, your order #12345 has been shipped. Track it online.';
  }
  // Marketing
  return hasVariables
    ? 'Hi {{name}}, enjoy {{discount}}% off on your next purchase. Use code {{code}} today.'
    : 'Hi there, enjoy 20% off on your next purchase. Use code WELCOME20 today.';
}

// ─────────────────────────────────────────────
// Combinations
// ─────────────────────────────────────────────

async function runTests() {
  console.log('[QA] Starting Template QA Automation...');
  
  // Initialize CSV
  fs.writeFileSync(CSV_FILE, 'TemplateName,Category,HeaderType,MediaUsed,Footer,Buttons,CTAType,Variables,Status,MetaError,FixApplied,FinalResult,Description,VariablesUsed,DosDonts\n');

  // Upload Media
  const handles = {
    IMAGE: await uploadMedia('IMAGE'),
    VIDEO: await uploadMedia('VIDEO'),
    DOCUMENT: await uploadMedia('DOCUMENT'),
  };

  const combinations = [];

  // Dimensions
  // const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
  const CATEGORIES = ['UTILITY']; // User requested only UTILITY (variables only)
  const HEADERS = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'];
  const FOOTERS = [true, false]; // true = with footer
  const BUTTONS = ['NONE', 'QUICK_REPLY', 'CTA', 'BOTH']; // Both = CTA + QR (valid in marketing)
  const CTA_TYPES = ['VISIT_WEBSITE', 'CALL_PHONE', 'COPY_COUPON'];
  const VARIABLES = [true];

  // Generate Combinations
  for (const category of CATEGORIES) {
    for (const header of HEADERS) {
      for (const footer of FOOTERS) {
        for (const btn of BUTTONS) {
          for (const vars of VARIABLES) {
            
            // 🚫 META RULES FILTERING
            
            // AUTHENTICATION RULES
            if (category === 'AUTHENTICATION') {
              if (header !== 'NONE') continue; // No media headers
              if (btn !== 'CTA') continue; // Only copy-code allowed usually, or strict rules
              if (!vars) continue; // Auth usually implies variable OTP
              // For Auth, we will special case the button to be OTP_CODE later
            }

            // UTILITY RULES
            if (category === 'UTILITY') {
              if (btn === 'CTA' || btn === 'BOTH') continue; // No promotional CTA (strictly speaking, utility can have CTA but usually restricted. User said "No promotional CTA buttons")
              if (header === 'VIDEO') continue; // User said "Media header allowed only if invoice/report related", video rare
            }

            // MARKETING RULES
            if (category === 'MARKETING') {
               // Most allowed
            }

            // Button Logic Specifics
            let ctaTypeToTest = ['NONE'];
            if (btn === 'CTA' || btn === 'BOTH') {
               ctaTypeToTest = CTA_TYPES;
            }

            for (const ctaType of ctaTypeToTest) {
              // Auth specific button override
              if (category === 'AUTHENTICATION') {
                 if (ctaType !== 'COPY_COUPON') continue; 
              }

              // Skip invalid CTA combos
              if (btn === 'NONE' && ctaType !== 'NONE') continue;
              if (btn === 'QUICK_REPLY' && ctaType !== 'NONE') continue;

              combinations.push({
                category,
                header,
                footer,
                buttons: btn,
                ctaType,
                variables: vars
              });
            }
          }
        }
      }
    }
  }

  console.log(`[QA] Generated ${combinations.length} valid combinations.`);
  stats.total = combinations.length;

  // Execute Tests
  for (const combo of combinations) {
    await testCombination(combo, handles);
    // Rate limit manual delay
    await new Promise(r => setTimeout(r, 500)); 
  }

  generateReport();

  logResult({
    name: 'INT',
    category: 'SUMMARY',
    header: '',
    media: '',
    footer: '',
    buttons: '',
    ctaType: '',
    variables: '',
    status: `total=${stats.total};approved=${stats.approved};rejected=${stats.rejected}`,
    finalResult: 'SUMMARY',
    description: 'Integer summary row',
    variablesUsed: '',
    dosDonts: '',
  });
}

async function testCombination(combo, handles, isRetry = false) {
  const { category, header, footer, buttons, ctaType, variables } = combo;
  
  if (category === 'AUTHENTICATION') {
    const timestamp = Date.now().toString().slice(-4);
    const footerStr = footer ? 'footer' : 'nofooter';
    const name = `authentication_none_otp_${footerStr}_otp_vars_${timestamp}`
      .replace(/_{2,}/g, '_')
      .substring(0, 60);

    const components = [];

    const bodyComp = {
      type: 'BODY',
      add_security_recommendation: true,
      example: { body_text: [['123456']] },
    };
    components.push(bodyComp);

    if (footer) {
      components.push({ type: 'FOOTER', code_expiration_minutes: 5 });
    }

    components.push({
      type: 'BUTTONS',
      buttons: [
        {
          type: 'OTP',
          otp_type: 'COPY_CODE',
          text: 'Copy Code',
        },
      ],
    });

    const payload = {
      name,
      category: 'AUTHENTICATION',
      language: 'en_US',
      message_send_ttl_seconds: 600,
      components,
    };

    try {
      console.log(`[QA] Testing AUTH template: ${name}`);
      const res = await whatsappClient.createTemplate(WABA_ID, payload);
      const status = res.data.status || 'APPROVED';

      stats.valid++;
      stats.approved++;
      stats.byCategory.AUTHENTICATION.total++;
      stats.byCategory.AUTHENTICATION.approved++;

      logResult({
        name,
        category: 'AUTHENTICATION',
        header: 'NONE',
        media: false,
        footer,
        buttons: 'OTP',
        ctaType: 'COPY_CODE',
        variables: true,
        status,
        finalResult: 'PASS',
        description: `Authentication OTP template (COPY_CODE), footer=${footerStr}`,
        variablesUsed: 'Positional Params',
        dosDonts: 'DO: Use only OTP verification text. DONT: Add URLs, media, coupons, or marketing language.',
      });
      return;
    } catch (err) {
      const apiError = err.response?.error;
      const errorMsg = apiError?.message || err.message;
      const errorData = apiError?.error_data ? JSON.stringify(apiError.error_data) : '';
      const combinedError = errorData ? `${errorMsg} | ${errorData}` : errorMsg;

      stats.rejected++;
      stats.byCategory.AUTHENTICATION.total++;
      stats.byCategory.AUTHENTICATION.rejected++;
      stats.reasons[errorMsg] = (stats.reasons[errorMsg] || 0) + 1;

      logResult({
        name,
        category: 'AUTHENTICATION',
        header: 'NONE',
        media: false,
        footer,
        buttons: 'OTP',
        ctaType: 'COPY_CODE',
        variables: true,
        status: 'REJECTED',
        metaError: combinedError,
        finalResult: 'FAIL',
        description: `Authentication OTP template (COPY_CODE), footer=${footerStr}`,
        variablesUsed: 'Positional Params',
        dosDonts: 'DO: Use OTP only. DONT: Add URLs/media/coupons. Ensure otp_type is COPY_CODE.',
      });
      return;
    }
  }

  // Format: <Category>_<Header>_<Buttons>_<Footer>_<Purpose>_<Timestamp>
  // Ensure lowercase and underscores only as per Meta rules
  let purpose = '';
  if (category === 'AUTHENTICATION') purpose = 'otp';
  else if (category === 'UTILITY') purpose = 'update';
  else purpose = 'promo';

  // Specific purpose suffix based on CTA or vars
  if (ctaType === 'COPY_COUPON') purpose = 'coupon';
  if (category === 'UTILITY' && header === 'DOCUMENT') purpose = 'invoice';

  const footerStr = footer ? 'footer' : 'nofooter';
  const varsStr = variables ? 'vars' : 'novars';
  const buttonStr = buttons === 'BOTH' ? 'cta_qr' : buttons.toLowerCase();
  
  const timestamp = Date.now().toString().slice(-4);
  
  // Construct name
  const name = `${category.toLowerCase()}_${header.toLowerCase()}_${buttonStr}_${footerStr}_${purpose}_${varsStr}_${timestamp}`
    .replace(/_{2,}/g, '_') // Remove double underscores
    .substring(0, 512);     // Meta limit
  
  const components = [];

  // 1. Header
  if (header !== 'NONE') {
    const headerComp = { type: 'HEADER', format: header };
    if (header === 'TEXT') {
      if (category === 'UTILITY') {
        headerComp.text = 'Order update';
      } else {
        headerComp.text = variables ? 'Welcome {{1}}' : 'Welcome to our service';
        if (variables) {
          headerComp.example = { header_text: ['John'] };
        }
      }
    } else {
      // Media
      if (handles[header]) {
         // Examples are attached at the template level, not component level in creation payload typically, 
         // BUT for 'createTemplate' endpoint, they are inside components structure usually?
         // Let's double check Meta API. 
         // POST /message_templates: components: [{type: HEADER, format: IMAGE, example: {header_handle: [h]}}]
         headerComp.example = { header_handle: [handles[header]] };
      }
    }
    components.push(headerComp);
  }

  // 2. Body
  const bodyText = isRetry && combo.useNamed ? generateNamedContent(category, variables) : generateContent(category, variables);
  const bodyComp = { type: 'BODY', text: bodyText };
  if (variables) {
     const example = isRetry && combo.useNamed 
        ? getNamedExample(category, variables, header, handles[header])
        : getExample(category, variables, header, handles[header]);
        
     if (example) {
        if (example.body_text) bodyComp.example = { body_text: example.body_text };
        if (example.body_text_named_params) bodyComp.example = { body_text_named_params: example.body_text_named_params };
     }
  }
  components.push(bodyComp);

  // 3. Footer
  if (footer) {
    components.push({ type: 'FOOTER', text: 'Powered by QA Automation' });
  }

  // 4. Buttons
  if (buttons !== 'NONE') {
    const btns = [];
    if (buttons === 'QUICK_REPLY' || buttons === 'BOTH') {
      btns.push({ type: 'QUICK_REPLY', text: 'Yes' });
      btns.push({ type: 'QUICK_REPLY', text: 'No' });
    }
    if (buttons === 'CTA' || buttons === 'BOTH') {
      if (ctaType === 'VISIT_WEBSITE') {
        btns.push({ type: 'URL', text: 'Visit Website', url: 'https://example.com' });
      } else if (ctaType === 'CALL_PHONE') {
        btns.push({ type: 'PHONE_NUMBER', text: 'Call Us', phone_number: '+16505550100' });
      } else if (ctaType === 'COPY_COUPON') {
         if (category === 'AUTHENTICATION') {
            btns.push({ type: 'COPY_CODE', example: '123456' }); // Auth specific
         } else {
            btns.push({ type: 'COPY_CODE', example: 'WELCOME20' });
         }
      }
    }
    if (btns.length > 0) {
      components.push({ type: 'BUTTONS', buttons: btns });
    }
  }

  const payload = {
    name,
    category,
    components,
    language: 'en_US',
  };
  
  if (isRetry && combo.useNamed) {
     payload.parameter_format = 'NAMED';
  }

  try {
    console.log(`[QA] Testing: ${name} (Named: ${!!(isRetry && combo.useNamed)})`);
    const res = await whatsappClient.createTemplate(WABA_ID, payload);
    
    const status = res.data.status || 'APPROVED'; // Creation usually returns status or just id
    // Actually creation returns { id, status, category } often.
    
    stats.valid++;
    stats.approved++;
    stats.byCategory[category].total++;
    stats.byCategory[category].approved++;

    logResult({
      name, category, header, media: header !== 'NONE' && header !== 'TEXT', footer,
      buttons, ctaType, variables, status: 'APPROVED', finalResult: 'PASS',
      description: `Tested ${category} template with ${header} header, ${buttons} buttons`,
      variablesUsed: variables ? (isRetry && combo.useNamed ? 'Named Params' : 'Positional Params') : 'None',
      dosDonts: 'DO: Ensure valid phone numbers for CTA. DONT: Use promotional words in Utility.'
    });

  } catch (err) {
    const apiError = err.response && err.response.error ? err.response.error : null;
    const errorMsg = apiError && apiError.message ? apiError.message : err.message;
    const combinedError = apiError ? JSON.stringify(apiError) : String(errorMsg || err);
    console.error(`[QA] Failed: ${name} - ${errorMsg}`);
    
    // Auto-fix Logic
    if (!isRetry) {
       let fix = null;
       
       // Fix 1: Named Parameters Retry
       if (variables && (errorMsg.includes('parameter format') || errorMsg.includes('Invalid parameter') || errorMsg.includes('variable'))) {
          fix = 'Switching to NAMED parameters';
          combo.useNamed = true;
       } 
       // Fix 2: Footer / Header specific (existing logic)
       else if (errorMsg.includes('footer')) {
          fix = 'Removed Footer';
          combo.footer = false;
       } else if (errorMsg.includes('format')) {
          fix = 'Changed Header to TEXT';
          combo.header = 'TEXT';
       }

       if (fix) {
          console.log(`[QA] Attempting fix: ${fix}`);
          logResult({
            name, category, header, media: header !== 'NONE' && header !== 'TEXT', footer,
            buttons, ctaType, variables, status: 'REJECTED', metaError: combinedError, fixApplied: fix, finalResult: 'RETRYING',
            description: `Initial attempt failed for ${name}`,
            variablesUsed: variables ? 'Positional Params' : 'None',
            dosDonts: 'Retry with fix applied.'
          });
          await testCombination(combo, handles, true);
          return;
       }
    }

    stats.rejected++;
    stats.byCategory[category].total++;
    stats.byCategory[category].rejected++;
    stats.reasons[errorMsg] = (stats.reasons[errorMsg] || 0) + 1;

    logResult({
      name, category, header, media: header !== 'NONE' && header !== 'TEXT', footer,
      buttons, ctaType, variables, status: 'REJECTED', metaError: combinedError, finalResult: 'FAIL',
      description: `Final failure for ${name}`,
      variablesUsed: variables ? (isRetry && combo.useNamed ? 'Named Params' : 'Positional Params') : 'None',
      dosDonts: 'Review Meta guidelines for specific rejection reason.'
    });
  }
}

function generateReport() {
  const report = `
=============================================
WHATSAPP TEMPLATE QA AUTOMATION REPORT
=============================================
Total Combinations Generated: ${stats.total}
Total Valid Combinations Tested: ${stats.valid + stats.rejected}
Approval Rate: ${Math.round((stats.approved / (stats.valid + stats.rejected)) * 100)}%

BY CATEGORY:
---------------------------------------------
MARKETING:      ${stats.byCategory.MARKETING.approved} Approved / ${stats.byCategory.MARKETING.rejected} Rejected
UTILITY:        ${stats.byCategory.UTILITY.approved} Approved / ${stats.byCategory.UTILITY.rejected} Rejected
AUTHENTICATION: ${stats.byCategory.AUTHENTICATION.approved} Approved / ${stats.byCategory.AUTHENTICATION.rejected} Rejected

COMMON REJECTION REASONS:
---------------------------------------------
${Object.entries(stats.reasons).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

SUGGESTIONS:
---------------------------------------------
1. Avoid promotional words in Utility templates.
2. Ensure media headers have valid examples.
3. Authentication templates must be strict (No footer, no media).

See template_qa_results.csv for detailed logs.
`;

  fs.writeFileSync(REPORT_FILE, report);
  console.log('\n[QA] Report generated at:', REPORT_FILE);
  console.log(report);
}

// Run
if (!WABA_ID) {
  console.error('Error: WHATSAPP_BUSINESS_ACCOUNT_ID is missing in .env');
  process.exit(1);
}

runTests().catch(err => console.error(err));
