'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const whatsappClient = require('../src/integrations/meta/whatsappClient');

const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

// Media paths
const FILES_DIR = path.join(__dirname, '..', 'files');
const DOC_PATH = path.join(FILES_DIR, 'document.pdf');
const IMG_PATH = path.join(FILES_DIR, 'image.png');
const VID_PATH = path.join(FILES_DIR, 'video.mp4');

// Template Definitions
const TEMPLATES_TO_CREATE = [
  {
    name: 'cma_welcome_v1',
    category: 'MARKETING',
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
        example: { header_handle: ['__HANDLE__'] } // Placeholder
      },
      {
        type: 'BODY',
        text: 'Welcome to Greeto Academy! 🎓\n\nThank you for inquiring about *CMA USA*. You are one step closer to a global finance career.\n\nWe have attached the detailed course brochure above. 👇\n\nDo you have any specific questions?'
      },
      {
        type: 'FOOTER',
        text: 'Greeto Academy'
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Course Fees?' },
          { type: 'QUICK_REPLY', text: 'Duration?' }
        ]
      }
    ],
    mediaPath: DOC_PATH,
    mediaType: 'application/pdf'
  },
  {
    name: 'cma_social_proof',
    category: 'MARKETING',
    components: [
      {
        type: 'HEADER',
        format: 'VIDEO',
        example: { header_handle: ['__HANDLE__'] }
      },
      {
        type: 'BODY',
        text: 'Meet Priya! 🌟\n\nShe cleared both parts of CMA USA in just *8 months* while working full-time.\n\nWatch her success story above. If she can do it, so can you! 💪'
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'URL', text: 'Watch Full Interview', url: 'https://youtube.com/watch?v=xyz' }
        ]
      }
    ],
    mediaPath: VID_PATH,
    mediaType: 'video/mp4'
  },
  {
    name: 'cpa_welcome_v1',
    category: 'MARKETING',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
        example: { header_handle: ['__HANDLE__'] }
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}! 👋\n\nReady to become a US CPA? 🇺🇸\n\nWith just 4 exams, you can unlock global opportunities in the Big 4 and MNCs.\n\nReply with "YES" to schedule a free counseling session.',
        example: { body_text: [['John']] }
      },
      {
        type: 'FOOTER',
        text: 'Greeto Academy'
      }
    ],
    mediaPath: IMG_PATH,
    mediaType: 'image/png'
  }
];

async function run() {
  if (!WABA_ID) {
    console.error('Missing WHATSAPP_BUSINESS_ACCOUNT_ID in env');
    process.exit(1);
  }

  console.log(`Starting template creation for WABA: ${WABA_ID}`);
  const client = await db.getClient();

  try {
    for (const t of TEMPLATES_TO_CREATE) {
      console.log(`\nProcessing template: ${t.name}...`);
      
      // 1. Check if template exists on Meta
      // (Optional optimization: list templates first, but create usually fails if exists)
      
      // 2. Upload Media if needed
      let handle = null;
      if (t.mediaPath && fs.existsSync(t.mediaPath)) {
        console.log(`  Uploading media: ${t.mediaPath} (${t.mediaType})...`);
        const buffer = fs.readFileSync(t.mediaPath);
        const filename = path.basename(t.mediaPath);
        try {
          const uploadRes = await whatsappClient.uploadMessageTemplateMedia(WABA_ID, buffer, t.mediaType, filename);
          handle = uploadRes.h;
          console.log(`  Media uploaded. Handle: ${handle}`);
        } catch (err) {
          console.error(`  Media upload failed: ${err.message}`);
          continue; // Skip this template
        }
      } else if (t.mediaPath) {
        console.warn(`  Media file not found: ${t.mediaPath}`);
        continue;
      }

      // 3. Prepare components
      const components = JSON.parse(JSON.stringify(t.components));
      // Inject handle
      const headerComp = components.find(c => c.type === 'HEADER');
      if (headerComp && headerComp.example && headerComp.example.header_handle) {
        if (handle) {
          headerComp.example.header_handle = [handle];
        } else {
          // Should not happen if mediaPath exists
          console.warn('  No handle available for header.');
        }
      }

      // 4. Create Template via API
      try {
        const payload = {
          name: t.name,
          category: t.category,
          components: components,
          language: 'en_US'
        };
        console.log('  Sending create request to Meta...');
        const res = await whatsappClient.createTemplate(WABA_ID, payload);
        console.log(`  Template created successfully! ID: ${res.data.id}`);

        // 5. Update Local DB Status
        await client.query(`
          UPDATE whatsapp_templates 
          SET status = 'PENDING', updated_at = NOW()
          WHERE name = $1
        `, [t.name]);
        console.log('  Local DB status updated to PENDING.');

      } catch (err) {
        if (err.message.includes('name already exists')) {
          console.log('  Template already exists on Meta. Skipping creation.');
          // Ideally fetch status and update DB
        } else {
          console.error(`  Creation failed: ${err.message}`);
          if (err.response && err.response.error) {
            console.error('  Meta Error:', JSON.stringify(err.response.error, null, 2));
          }
        }
      }
    }
  } catch (err) {
    console.error('Script failed:', err);
  } finally {
    client.release();
    await db.close();
  }
}

run();
