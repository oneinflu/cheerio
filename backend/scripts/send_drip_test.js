'use strict';
require('dotenv').config();
const whatsappClient = require('../src/integrations/meta/whatsappClient');

const RECIPIENT = '9182151640';
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const MEDIA_MAP = {
    'brochure': 'https://drive.google.com/uc?export=download&id=1gmzd6dtAhteAN_KYGRObcHrAT5LPhA_x',
    'success_report': 'https://drive.google.com/uc?export=download&id=1iuQ2T12EQYNFWl7j2jtDMMetYJB-HP2c',
    'irfat_sir': 'https://drive.google.com/uc?export=download&id=12lYvLCelDP8_zMse1G63QeK6Rrc1QHhX',
    'prathamesh': 'https://drive.google.com/uc?export=download&id=1bnkuKt7tXLXcLywWWWkwoD8fx6GC7WJf',
    'syllabus': 'https://drive.google.com/uc?export=download&id=1NwpfcNnk3kBqxrotPD984ZEHCDbsc5IW',
    'ravi': 'https://drive.google.com/uc?export=download&id=14JKcsh3Qo__zoQ5YDb-rowCBEyduql_-',
    'dipen': 'https://drive.google.com/uc?export=download&id=1By6DfniM6YlGZOZ-__i4dAZUJZcYff-b',
    'hacks': 'https://drive.google.com/uc?export=download&id=1FVcamVWkjvS20Rm06QGLYRAnisRHxGkm',
    'simani': 'https://drive.google.com/uc?export=download&id=1ENBAx0ZVHuH8CxIGREQoUHhMHGQpmP43'
};

const TEMPLATE_LIST = [
    'nsa_cpa_welcome_v1',
    'nsa_cpa_mentor_v1',
    'nsa_cpa_success_v1',
    'nsa_cpa_syllabus_v1',
    'nsa_cpa_pro_success_v1',
    'nsa_cpa_webinar_v1',
    'nsa_cpa_placed_v1',
    'nsa_cpa_hacks_v1',
    'nsa_cpa_alumni_v1',
    'nsa_cpa_exam_v1',
    'nsa_cma_alumni_v1'
];

async function sendAll() {
    console.log('[DripTester] Fetching current statuses from Meta...');
    const resp = await whatsappClient.getTemplates(WABA_ID);
    const metaTemplates = resp.data && resp.data.data ? resp.data.data : [];
    
    console.log(`[DripTester] Found ${metaTemplates.length} templates total.`);

    for (const name of TEMPLATE_LIST) {
        const metaT = metaTemplates.find(t => t.name === name);
        if (!metaT) {
            console.warn(`[DripTester] Template ${name} not found on Meta.`);
            continue;
        }

        console.log(`[DripTester] Checking ${name}. Status: ${metaT.status}`);

        if (metaT.status !== 'APPROVED') {
            console.warn(`[DripTester] Skipping ${name} - not yet approved.`);
            continue;
        }

        // Prepare components for sending
        const components = [];
        const headerComp = metaT.components.find(c => c.type === 'HEADER');
        const bodyComp = metaT.components.find(c => c.type === 'BODY');

        // 1. Header Parameter
        if (headerComp) {
            let mediaType = headerComp.format.toLowerCase();
            let mediaUrl = '';
            
            if (name.includes('welcome') || name.includes('exam')) mediaUrl = MEDIA_MAP.brochure;
            else if (name.includes('mentor')) mediaUrl = MEDIA_MAP.irfat_sir;
            else if (name.includes('success_v1')) mediaUrl = MEDIA_MAP.prathamesh;
            else if (name.includes('syllabus')) mediaUrl = MEDIA_MAP.syllabus;
            else if (name.includes('pro_success')) mediaUrl = MEDIA_MAP.ravi;
            else if (name.includes('placed')) mediaUrl = MEDIA_MAP.dipen;
            else if (name.includes('hacks')) mediaUrl = MEDIA_MAP.hacks;
            else if (name.includes('alumni_v1')) mediaUrl = MEDIA_MAP.simani;
            else if (name.includes('cma_alumni')) mediaUrl = MEDIA_MAP.success_report;

            if (mediaUrl) {
                components.push({
                    type: 'header',
                    parameters: [{
                        type: mediaType,
                        [mediaType]: { link: mediaUrl }
                    }]
                });
            }
        }

        // 2. Body Parameter (for {{1}})
        if (bodyComp && bodyComp.text.includes('{{1}}')) {
            components.push({
                type: 'body',
                parameters: [{ type: 'text', text: 'User' }]
            });
        }

        console.log(`[DripTester] Sending ${name} to ${RECIPIENT}...`);
        try {
            await whatsappClient.sendTemplate(PHONE_NUMBER_ID, RECIPIENT, name, 'en_US', components);
            console.log(`[DripTester] SENT: ${name}`);
        } catch (e) {
            console.error(`[DripTester] FAILED: ${name}. Error: ${e.message}`);
        }
    }
}

sendAll();
