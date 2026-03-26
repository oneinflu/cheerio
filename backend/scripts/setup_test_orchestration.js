require('dotenv').config();
const db = require('../db');

async function setup() {
  console.log('--- Setting up Test Orchestration Funnel ---');
  
  // 1. Create WhatsApp Templates (Mocked as LOCAL)
  const t1 = await db.query(`
    INSERT INTO whatsapp_templates (name, components, status)
    VALUES ($1, $2, $3)
    ON CONFLICT (name) DO UPDATE SET components = $2, status = $3
    RETURNING id
  `, ['n2_welcome_test', JSON.stringify([{ type: 'BODY', text: 'Hello! Welcome to Greeto. This is step 1.' }]), 'APPROVED']);
  
  const t2 = await db.query(`
    INSERT INTO whatsapp_templates (name, components, status)
    VALUES ($1, $2, $3)
    ON CONFLICT (name) DO UPDATE SET components = $2, status = $3
    RETURNING id
  `, ['n2_followup_test', JSON.stringify([{ type: 'BODY', text: 'Hi again! Just checking in after 10 mins. This is step 2.' }]), 'APPROVED']);

  console.log('✅ Templates created.');

  // 2. Create Workflows
  const wf1 = await db.query(`
    INSERT INTO workflows (name, description, steps)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [
    'Test Workflow 1: Welcome',
    'Sends a welcome message immediately upon stage entry',
    JSON.stringify({
      nodes: [
        { id: '1', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'Manual' } },
        { id: '2', type: 'send_template', position: { x: 250, y: 150 }, data: { template: 'n2_welcome_test' } }
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }]
    })
  ]);

  const wf2 = await db.query(`
    INSERT INTO workflows (name, description, steps)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [
    'Test Workflow 2: Follow-up',
    'Sends a follow-up message after 10 minutes',
    JSON.stringify({
      nodes: [
        { id: '1', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'Manual' } },
        { id: '2', type: 'send_template', position: { x: 250, y: 150 }, data: { template: 'n2_followup_test' } }
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }]
    })
  ]);

  console.log('✅ Workflows created.');

  // 3. Link to N2 Fresh Leads Stage
  const stageRes = await db.query("SELECT id FROM lead_stages WHERE name = 'N2 Fresh Leads' LIMIT 1");
  if (stageRes.rowCount === 0) {
    console.error('❌ Stage N2 Fresh Leads not found!');
    process.exit(1);
  }
  const stageId = stageRes.rows[0].id;

  // Clear existing mappings for this stage for clean test
  await db.query("DELETE FROM lead_stage_workflows WHERE stage_id = $1", [stageId]);

  // Insert Step 1 (Instant)
  await db.query(`
    INSERT INTO lead_stage_workflows (stage_id, workflow_id, position, delay_minutes)
    VALUES ($1, $2, 0, 0)
  `, [stageId, wf1.rows[0].id]);

  // Insert Step 2 (10 min delay)
  await db.query(`
    INSERT INTO lead_stage_workflows (stage_id, workflow_id, position, delay_minutes)
    VALUES ($1, $2, 1, 10)
  `, [stageId, wf2.rows[0].id]);

  console.log('✅ Drip Orchestration Linked to N2 Fresh Leads.');

  // 4. Trigger for specific number: 919182151640
  const testNumber = '919182151640';
  console.log(`--- Triggering Test for Number: ${testNumber} ---`);
  
  const contactRes = await db.query("SELECT id, external_id FROM contacts WHERE external_id LIKE $1 LIMIT 1", [`%${testNumber}%`]);
  if (contactRes.rowCount > 0) {
    const contactId = contactRes.rows[0].id;
    // Lead stage is on conversations table in this schema
    const convRes = await db.query("SELECT id FROM conversations WHERE contact_id = $1 LIMIT 1", [contactId]);
    if (convRes.rowCount > 0) {
      await db.query("UPDATE conversations SET lead_stage_id = $1 WHERE id = $2", [stageId, convRes.rows[0].id]);
      console.log(`✅ Conversation for ${testNumber} moved to N2 Fresh Leads.`);
      
      // TRIGGER THE WORKFLOW SERVICE MANUALLY
      try {
        const { runStageWorkflows } = require('../src/services/workflows');
        const phoneNumber = contactRes.rows[0].external_id;
        console.log(`🚀 Manually triggering orchestration for ${phoneNumber}...`);
        await runStageWorkflows(stageId, phoneNumber);
        console.log(`✅ Orchestration triggered successfully.`);
      } catch (triggerErr) {
        console.error(`⚠️ Failed to trigger workflow service:`, triggerErr.message);
        console.log(`💡 Tip: You can also manually toggle the stage to "N2 Fresh Leads" in the UI to trigger.`);
      }
    } else {
      console.log(`⚠️ No active conversation found for ${testNumber}. Moving stage might not trigger workflow correctly.`);
    }
  } else {
    console.log(`⚠️ Contact ${testNumber} not found in DB. Please ensure they have messaged the bot once.`);
  }

  console.log('🚀 READY FOR TESTING!');
  db.close();
}

setup().catch(err => {
  console.error(err);
  process.exit(1);
});
