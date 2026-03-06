'use strict';
require('dotenv').config();
const db = require('../db');

const EMAIL_TEMPLATES = [
  {
    name: 'CMA USA - Detailed Guide',
    subject: 'Everything you need to know about CMA USA 🎓',
    html_body: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h1>Become a CMA (Certified Management Accountant)</h1>
        <p>Hi {{name}},</p>
        <p>Thank you for your interest in the CMA USA program. Here is why it's a great career choice:</p>
        <ul>
          <li><strong>Global Recognition:</strong> Valid in 100+ countries.</li>
          <li><strong>Short Duration:</strong> Complete in just 6-9 months.</li>
          <li><strong>High Salary:</strong> Earn 50% more than non-certified accountants.</li>
        </ul>
        <p><a href="https://example.com/cma-guide" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Brochure</a></p>
        <p>Best Regards,<br>Greeto Academy Team</p>
      </div>
    `,
    text_body: `Hi {{name}}, Thank you for your interest in CMA USA. It is globally recognized and can be completed in 6-9 months. Download brochure: https://example.com/cma-guide`,
    variables: ['name']
  },
  {
    name: 'CPA USA - Syllabus Breakdown',
    subject: 'Your Roadmap to US CPA 🇺🇸',
    html_body: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h1>US CPA Exam Structure</h1>
        <p>Hi {{name}},</p>
        <p>The US CPA exam consists of 4 core sections:</p>
        <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <tr><th>Section</th><th>Topic</th></tr>
          <tr><td>AUD</td><td>Auditing & Attestation</td></tr>
          <tr><td>BEC</td><td>Business Environment & Concepts</td></tr>
          <tr><td>FAR</td><td>Financial Accounting & Reporting</td></tr>
          <tr><td>REG</td><td>Regulation (Tax)</td></tr>
        </table>
        <p>Ready to start? <a href="https://example.com/enroll">Enroll Now</a></p>
      </div>
    `,
    text_body: `Hi {{name}}, The US CPA exam has 4 sections: AUD, BEC, FAR, REG. Ready to start? Visit https://example.com/enroll`,
    variables: ['name']
  }
];

const WHATSAPP_TEMPLATES = [
  {
    name: 'cma_welcome_v1',
    language: 'en_US',
    category: 'MARKETING',
    components: [
      { type: 'HEADER', format: 'DOCUMENT', example: { header_handle: ['https://example.com/files/cma_brochure.pdf'] } },
      { type: 'BODY', text: 'Welcome to Greeto Academy! 🎓\n\nThank you for inquiring about *CMA USA*. You are one step closer to a global finance career.\n\nWe have attached the detailed course brochure above. 👇\n\nDo you have any specific questions?' },
      { type: 'FOOTER', text: 'Greeto Academy' },
      { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Course Fees?' }, { type: 'QUICK_REPLY', text: 'Duration?' }] }
    ]
  },
  {
    name: 'cma_social_proof',
    language: 'en_US',
    category: 'MARKETING',
    components: [
      { type: 'HEADER', format: 'VIDEO', example: { header_handle: ['https://example.com/files/student_success.mp4'] } },
      { type: 'BODY', text: 'Meet Priya! 🌟\n\nShe cleared both parts of CMA USA in just *8 months* while working full-time.\n\nWatch her success story above. If she can do it, so can you! 💪' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Watch Full Interview', url: 'https://youtube.com/watch?v=xyz' }] }
    ]
  },
  {
    name: 'cpa_welcome_v1',
    language: 'en_US',
    category: 'MARKETING',
    components: [
      { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['https://example.com/files/cpa_banner.png'] } },
      { type: 'BODY', text: 'Hi {{1}}! 👋\n\nReady to become a US CPA? 🇺🇸\n\nWith just 4 exams, you can unlock global opportunities in the Big 4 and MNCs.\n\nReply with "YES" to schedule a free counseling session.' },
      { type: 'FOOTER', text: 'Greeto Academy' }
    ]
  }
];

async function seed() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    console.log('Seeding Email Templates...');
    for (const t of EMAIL_TEMPLATES) {
      await client.query(`
        INSERT INTO email_templates (name, subject, html_body, text_body, variables, design)
        VALUES ($1, $2, $3, $4, $5, '[]'::jsonb)
        ON CONFLICT (name) DO NOTHING
      `, [t.name, t.subject, t.html_body, t.text_body, JSON.stringify(t.variables)]);
    }

    console.log('Seeding WhatsApp Templates...');
    for (const t of WHATSAPP_TEMPLATES) {
      await client.query(`
        INSERT INTO whatsapp_templates (name, language, category, components, status)
        VALUES ($1, $2, $3, $4, 'LOCAL')
        ON CONFLICT (name) DO NOTHING
      `, [t.name, t.language, t.category, JSON.stringify(t.components)]);
    }

    // Fetch IDs for references
    const emailRes = await client.query('SELECT id, name FROM email_templates');
    const emailMap = {};
    emailRes.rows.forEach(r => emailMap[r.name] = r.id);

    // Create Workflows
    console.log('Seeding Workflows...');
    
    // CMA USA Drip
    const cmaSteps = {
      nodes: [
        { id: 'start', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'New Lead (CMA)', triggerType: 'new_contact' } },
        { id: 'tag1', type: 'action', position: { x: 250, y: 100 }, data: { label: 'Add Tag: CMA', actionType: 'add_to_label', actionValue: 'CMA Student' } },
        { id: 'wa1', type: 'send_template', position: { x: 250, y: 200 }, data: { label: 'Send Brochure', template: 'cma_welcome_v1', languageCode: 'en_US' } },
        { id: 'email1', type: 'action', position: { x: 250, y: 300 }, data: { label: 'Send Guide Email', actionType: 'send_email', emailTemplateId: emailMap['CMA USA - Detailed Guide'], toVarKey: 'email' } },
        { id: 'delay1', type: 'delay', position: { x: 250, y: 400 }, data: { label: 'Wait 24 Hours', duration: 1, unit: 'days' } },
        { id: 'cond1', type: 'condition', position: { x: 250, y: 500 }, data: { label: 'User Replied?', conditionType: 'user_replied' }, routes: { true: 'assign1', false: 'wa2' } },
        { id: 'assign1', type: 'action', position: { x: 100, y: 650 }, data: { label: 'Assign Agent', actionType: 'assign_agent', actionValue: 'round_robin' } },
        { id: 'wa2', type: 'send_template', position: { x: 400, y: 650 }, data: { label: 'Social Proof', template: 'cma_social_proof', languageCode: 'en_US' } }
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'tag1' },
        { id: 'e2', source: 'tag1', target: 'wa1' },
        { id: 'e3', source: 'wa1', target: 'email1' },
        { id: 'e4', source: 'email1', target: 'delay1' },
        { id: 'e5', source: 'delay1', target: 'cond1' }
      ]
    };

    // CPA USA Drip
    const cpaSteps = {
      nodes: [
        { id: 'start', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'New Lead (CPA)', triggerType: 'new_contact' } },
        { id: 'tag1', type: 'action', position: { x: 250, y: 100 }, data: { label: 'Add Tag: CPA', actionType: 'add_to_label', actionValue: 'CPA Student' } },
        { id: 'wa1', type: 'send_template', position: { x: 250, y: 200 }, data: { label: 'Send Welcome', template: 'cpa_welcome_v1', languageCode: 'en_US' } },
        { id: 'email1', type: 'action', position: { x: 250, y: 300 }, data: { label: 'Send Syllabus', actionType: 'send_email', emailTemplateId: emailMap['CPA USA - Syllabus Breakdown'], toVarKey: 'email' } }
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'tag1' },
        { id: 'e2', source: 'tag1', target: 'wa1' },
        { id: 'e3', source: 'wa1', target: 'email1' }
      ]
    };

    await client.query(`
      INSERT INTO workflows (name, description, status, steps)
      VALUES 
      ('CMA USA Drip Campaign', 'Automated nurture for CMA leads', 'active', $1),
      ('CPA USA Drip Campaign', 'Automated nurture for CPA leads', 'active', $2)
    `, [JSON.stringify(cmaSteps), JSON.stringify(cpaSteps)]);

    await client.query('COMMIT');
    console.log('Seeding completed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', e);
    process.exit(1);
  } finally {
    client.release();
    await db.close();
  }
}

seed();
