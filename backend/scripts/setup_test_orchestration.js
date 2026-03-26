require('dotenv').config();
const db = require('../db');
const whatsappClient = require('../src/integrations/meta/whatsappClient');

async function setup() {
  console.log('--- Setting up Verified Test Orchestration Funnel ---');
  
  // 1. Fetch APPROVED templates from Meta
  console.log('🔍 Checking Meta for approved templates...');
  const metaRes = await whatsappClient.getTemplates();
  const approved = metaRes.data.data.filter(t => t.status === 'APPROVED');
  
  const welcomeT = approved.find(t => t.name === 'welcome_message_general');
  const helloT = approved.find(t => t.name === 'hello_world');

  if (!welcomeT || !helloT) {
    console.error('❌ Could not find approved "welcome_message_general" and "hello_world" templates in Meta.');
    console.log('Available approved templates:', approved.map(t => t.name).join(', '));
    process.exit(1);
  }

  console.log('✅ Found approved templates in Meta. Syncing to local DB...');

  // Upsert to local DB for consistency
  for (const t of [welcomeT, helloT]) {
    await db.query(`
      INSERT INTO whatsapp_templates (name, components, status, language, category)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO UPDATE SET components = $2, status = $3
    `, [t.name, JSON.stringify(t.components), t.status, t.language, t.category]);
  }

  // 2. Create Workflows
  console.log('🛠️ Creating Workflows...');
  const wf1 = await db.query(`
    INSERT INTO workflows (name, description, steps)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [
    'Verified Test: Welcome (Step 1)',
    'Sends Meta-approved welcome_message_general',
    JSON.stringify({
      nodes: [
        { id: '1', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'Manual' } },
        { id: '2', type: 'send_template', position: { x: 250, y: 150 }, data: { template: 'welcome_message_general' } }
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }]
    })
  ]);

  const wf2 = await db.query(`
    INSERT INTO workflows (name, description, steps)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [
    'Verified Test: Hello World (Step 2)',
    'Sends Meta-approved hello_world after 5 mins',
    JSON.stringify({
      nodes: [
        { id: '1', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'Manual' } },
        { id: '2', type: 'send_template', position: { x: 250, y: 150 }, data: { template: 'hello_world' } }
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }]
    })
  ]);

  // 3. Link to N2 Fresh Leads Stage
  const stageRes = await db.query("SELECT id FROM lead_stages WHERE name = 'N2 Fresh Leads' LIMIT 1");
  if (stageRes.rowCount === 0) {
    console.error('❌ Stage N2 Fresh Leads not found! Creating it...');
    const ns = await db.query("INSERT INTO lead_stages (name, color) VALUES ('N2 Fresh Leads', '#00E676') RETURNING id");
    stageId = ns.rows[0].id;
  } else {
    stageId = stageRes.rows[0].id;
  }

  // Clear existing mappings
  await db.query("DELETE FROM lead_stage_workflows WHERE stage_id = $1", [stageId]);

  // Step 1: Instant
  await db.query(`
    INSERT INTO lead_stage_workflows (stage_id, workflow_id, position, delay_minutes)
    VALUES ($1, $2, 0, 0)
  `, [stageId, wf1.rows[0].id]);

  // Step 2: 5 min delay
  await db.query(`
    INSERT INTO lead_stage_workflows (stage_id, workflow_id, position, delay_minutes)
    VALUES ($1, $2, 1, 5)
  `, [stageId, wf2.rows[0].id]);

  console.log('✅ Drip Sequence Linked (5 min delay).');

  // 4. Trigger for 919182151640
  const testNumber = '919182151640';
  console.log(`--- Triggering Test for ${testNumber} ---`);

  const contactRes = await db.query("SELECT id, external_id FROM contacts WHERE external_id LIKE $1 LIMIT 1", [`%${testNumber}%`]);
  if (contactRes.rowCount > 0) {
    const contactId = contactRes.rows[0].id;
    const convRes = await db.query("SELECT id FROM conversations WHERE contact_id = $1 LIMIT 1", [contactId]);
    
    if (convRes.rowCount > 0) {
      await db.query("UPDATE conversations SET lead_stage_id = $1 WHERE id = $2", [stageId, convRes.rows[0].id]);
      console.log(`✅ Conversation moved to N2 Fresh Leads.`);
      
      const { runStageWorkflows } = require('../src/services/workflows');
      await runStageWorkflows(stageId, contactRes.rows[0].external_id);
    } else {
      console.log('⚠️ No conversation found for test number.');
    }
  } else {
    console.log('⚠️ Contact not found in DB.');
  }

  console.log('🚀 TEST ORCHESTRATED SUCCESSFULLY!');
  db.close();
}

setup().catch(err => {
  console.error(err);
  process.exit(1);
});
