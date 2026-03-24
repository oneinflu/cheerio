'use strict';
require('dotenv').config();
const axios = require('axios');
const whatsappClient = require('../src/integrations/meta/whatsappClient');

const RECIPIENT = '9182151640';
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

const MEDIA_MAP = {
    'brochure': '1gmzd6dtAhteAN_KYGRObcHrAT5LPhA_x',
    'success_report': '1iuQ2T12EQYNFWl7j2jtDMMetYJB-HP2c',
    'irfat_sir': '12lYvLCelDP8_zMse1G63QeK6Rrc1QHhX',
    'prathamesh': '1bnkuKt7tXLXcLywWWWkwoD8fx6GC7WJf',
    'syllabus': '1NwpfcNnk3kBqxrotPD984ZEHCDbsc5IW',
    'ravi': '14JKcsh3Qo__zoQ5YDb-rowCBEyduql_-',
    'dipen': '1By6DfniM6YlGZOZ-__i4dAZUJZcYff-b',
    'hacks': '1FVcamVWkjvS20Rm06QGLYRAnisRHxGkm',
    'simani': '1ENBAx0ZVHuH8CxIGREQoUHhMHGQpmP43'
};

const TEMPLATE_DEFS = [
    {
        name: 'nsa_cpa_welcome_v1',
        category: 'MARKETING',
        header: { type: 'DOCUMENT', mediaKey: 'brochure' },
        body: 'Hello {{1}} 👋\n\nWelcome to *NorthStar Academy*.\n\n*US CPA + NorthStar* marks the start of a strong global career in accounting, audit, and finance.\n\n*Why US CPA stands out:*\n* Recognised across *120+ countries*\n* Just *4 exams*\n* Can be completed in *12 months*\n* High demand across *Big 4 firms & global MNCs*\n\nAt *NorthStar Academy*, CPA training is guided by *“God of Accounting” – M. Irfat Sir* (CA | CPA | CMA USA | CIMA), with a structured, exam-focused approach. \n\n*What you get at NorthStar:*\n* AICPA-aligned curriculum\n* High first-attempt pass success\n* Dedicated placement assistance\n* Support from preparation to placement',
        buttons: [{ type: 'URL', text: 'Placement Report', url: 'https://drive.google.com/file/d/1iuQ2T12EQYNFWl7j2jtDMMetYJB-HP2c/view' }]
    },
    {
        name: 'nsa_cpa_mentor_v1',
        category: 'MARKETING',
        header: { type: 'IMAGE', mediaKey: 'irfat_sir' },
        body: 'Your Mentor Isn’t Ordinary.\nHe’s Extraordinary – *M. Irfat Sir* 👑\n\nCA | CPA | CMA USA | CIMA\nPopularly Known as the *God of Costing*\n\nWith *25+ years of teaching and industry experience*, he has personally guided *2+ lakh students across the globe* through CMA with clarity and confidence.\n\nHe has:\n* Worked with *Big 4 & Fortune 500 companies*\n* Been *honoured with a Teaching Excellence Award*\n* Built a reputation for making complex costing concepts simple\n\nHis teaching focuses on:\n* Concept clarity over rote learning\n* Practical, exam-oriented approach\n* Interactive classes with real-time doubt resolution',
        buttons: [{ type: 'URL', text: 'LinkedIn Profile', url: 'https://www.linkedin.com/in/irfat-m/' }]
    },
    {
        name: 'nsa_cpa_success_v1',
        category: 'MARKETING',
        header: { type: 'IMAGE', mediaKey: 'prathamesh' },
        body: '*From CPA USA to PWC*\n\nMeet *Prathamesh Naik*, a *CPA-qualified professional from NorthStar Academy*.\n\nWith expert guidance from *M. Irfat Sir* and strong support from the *NorthStar Placement Team*, he has taken a major career step by joining *PwC India* as an *Associate*.\n\nRight mentor. Right preparation. Big 4 success.'
    },
    {
        name: 'nsa_cpa_syllabus_v1',
        category: 'MARKETING',
        header: { type: 'IMAGE', mediaKey: 'syllabus' },
        body: 'Here’s what you’ll study in *CPA USA* 📘\n\nThe CPA program is divided into *4 exam sections*, each designed to build strong Accounting, Audit, and Business skills:\n\n*AUD* – Auditing & Attestation\n*FAR* – Financial Accounting & Reporting\n*REG* – Regulation\n\nWith the right guidance and planning, working professionals typically complete *CPA USA in 12–18 months*.'
    },
    {
        name: 'nsa_cpa_pro_success_v1',
        category: 'MARKETING',
        header: { type: 'IMAGE', mediaKey: 'ravi' },
        body: 'Do you feel clearing *CMA or CPA* with a full-time job is impossible? 🤔\n\nMeet *Ravi Kumar* — a working professional, married, with two young children. Starting from scratch, he cleared *CMA USA* in his *first attempt* while working. Later, with the same discipline and guidance, he cleared *CPA* as well.\n\nIf Ravi could do it, so can you.'
    },
    {
        name: 'nsa_cpa_webinar_v1',
        category: 'MARKETING',
        body: 'Have Questions about *CPA USA*?\n\nJoin A *Free Live Webinar* with *M. Irfat Sir*, An Industry-Recognized CA | CPA | CMA | CIMA Professional.\n\nIn This Session, You’ll Gain Clarity on:\n* Whether CPA USA is Right for You\n* How to Prepare and Clear the Exams\n* How CPA Skills apply in Real-World Roles',
        buttons: [{ type: 'URL', text: 'Register Now', url: 'https://webinar.northstaracad.com/ccw-organic/' }]
    },
    {
        name: 'nsa_cpa_placed_v1',
        category: 'MARKETING',
        header: { type: 'IMAGE', mediaKey: 'dipen' },
        body: '*From NorthStar Academy to Withum* ⭐\n\nMeet *Dipen Datta*, a *CPA professional* placed at *Withum* in *Audit & Tax* with *₹9 LPA Fixed + Variable* package.\n\nGlobal firms don’t just hire degrees. They hire *CPA professionals with real-world skills*. Proud of your journey, Dipen!'
    },
    {
        name: 'nsa_cpa_hacks_v1',
        category: 'MARKETING',
        header: { type: 'DOCUMENT', mediaKey: 'hacks' },
        body: 'Preparing for *CPA USA* can feel overwhelming, but the *right strategy* makes all the difference.\n\nOur top *CPA performers* study *smarter*. That’s why we’ve created *15 Proven CPA Study Hacks* used by candidates who clear CPA *with confidence*.'
    },
    {
        name: 'nsa_cpa_alumni_v1',
        category: 'MARKETING',
        header: { type: 'IMAGE', mediaKey: 'simani' },
        body: '*Simani Hegde | CPA Qualified* 📍 *J.P. Morgan*\n\nAfter clearing *CMA USA*, Simani chose to push further and took on the *CPA challenge* with *NorthStar Academy*. MARKING yet another milestone in her journey.\n\nGrowth mindset. Global credentials. Real progress.'
    },
    {
        name: 'nsa_cpa_exam_v1',
        category: 'MARKETING',
        header: { type: 'DOCUMENT', mediaKey: 'brochure' },
        body: 'Understanding the *exam structure* makes preparation more confident 🎯\n\nThe *CPA USA Exam* has 4 sections testing conceptual clarity, application skills, and real-world decision-making.\n\nAt *NorthStar Academy*, preparation is aligned exactly to the *CPA exam format*, step by step.'
    },
    {
        name: 'nsa_cma_alumni_v1',
        category: 'MARKETING',
        header: { type: 'DOCUMENT', mediaKey: 'success_report' },
        body: 'Meet Our CMA USA Alumni 💼\n\nAfter completing CMA USA with *NorthStar Academy*, our alumni have moved into strong Finance Roles across Big 4 & Leading MNCs.\n\nTheir journey proves what’s possible with the Right Guidance.'
    }
];

async function downloadFromDrive(fileId) {
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return response.data;
    } catch (e) {
        console.warn(`Failed to download ${fileId}: ${e.message}`);
        return null;
    }
}

async function deleteTemplate(name) {
    const url = `https://graph.facebook.com/v22.0/${WABA_ID}/message_templates?name=${name}`;
    try {
        await axios.delete(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
        console.log(`[DripCreator] Deleted existing template: ${name}`);
    } catch (e) {
        // Ignore if template doesn't exist
    }
}

async function createAll() {
    console.log('[DripCreator] Starting template creation process...');
    
    // 1. Pre-upload media for handles
    const handles = {};
    for (const [key, id] of Object.entries(MEDIA_MAP)) {
        console.log(`[DripCreator] Processing media: ${key} (${id})...`);
        const buffer = await downloadFromDrive(id);
        if (!buffer) continue;
        
        const mime = id === MEDIA_MAP.brochure || id === MEDIA_MAP.hacks || id === MEDIA_MAP.success_report ? 'application/pdf' : 'image/jpeg';
        const filename = `${key}.${mime.split('/')[1]}`;
        
        try {
            const resp = await whatsappClient.uploadMessageTemplateMedia(WABA_ID, buffer, mime, filename);
            handles[key] = resp.h; // Fixed prop access
            console.log(`[DripCreator] Uploaded ${key}. Handle: ${handles[key]}`);
        } catch (e) {
            console.error(`[DripCreator] Failed to upload ${key}: ${e.message}`);
        }
    }

    // 2. Submit templates
    const results = [];
    for (const def of TEMPLATE_DEFS) {
        console.log(`[DripCreator] Creating template: ${def.name}...`);
        
        // Delete previous attempts for this session
        await deleteTemplate(def.name);

        const components = [];
        
        // Header
        if (def.header) {
            const handle = handles[def.header.mediaKey];
            if (handle) {
                components.push({
                    type: 'HEADER',
                    format: def.header.type,
                    example: { header_handle: [handle] }
                });
            }
        }
        
        // Body (check for {{1}})
        const text = def.body;
        const bodyComp = {
            type: 'BODY',
            text: text,
        };
        if (text.includes('{{1}}')) {
            bodyComp.example = { body_text: [['Student']] };
        }
        components.push(bodyComp);
        
        // Buttons
        if (def.buttons) {
            components.push({
                type: 'BUTTONS',
                buttons: def.buttons.map(b => ({
                    type: b.type,
                    text: b.text,
                    url: b.url
                }))
            });
        }

        const payload = {
            name: def.name,
            category: def.category,
            language: 'en_US',
            components
        };

        try {
            const resp = await whatsappClient.createTemplate(WABA_ID, payload);
            console.log(`[DripCreator] SUCCESS: ${def.name}. ID: ${resp.data.id}`);
            results.push({ name: def.name, id: resp.data.id, status: 'PENDING' });
        } catch (e) {
            console.error(`[DripCreator] FAILED: ${def.name}. Error: ${e.message}`);
            results.push({ name: def.name, error: e.message });
        }
    }

    console.log('\n[DripCreator] FINAL SUMMARY:');
    console.table(results);
}

createAll();
