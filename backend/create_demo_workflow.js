require('dotenv').config();
const { Pool } = require('pg');

async function create() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const templateName = 'marketing_image_promo_1774270741'; 
    const mediaId = '2340006203150493'; // The one just uploaded/obtained
    
    // Workflow structure
    const workflow = {
      name: 'XOLOX CRM Auto-Lead & Template',
      status: 'active',
      steps: {
        trigger: 'new_contact',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 250, y: 50 },
            data: { triggerType: 'new_contact', label: 'Trigger: New Contact Added' }
          },
          {
            id: 'xolox-1',
            type: 'xolox_event',
            position: { x: 250, y: 150 },
            data: { 
              webhookUrl: 'https://api.starforze.com/api/webhook/whatsapp-lead', 
              method: 'POST', 
              payloadFields: [
                { field: 'name', variable: '{{name}}' },
                { field: 'mobile', variable: '{{mobile}}' },
                { field: 'course', variable: '{{course}}' }
              ],
              successCondition: 'status_2xx'
            }
          },
          {
            id: 'assign-1',
            type: 'action',
            position: { x: 250, y: 250 },
            data: { 
              actionType: 'assign_agent_xolox', 
              actionValue: undefined, 
              label: 'Assign from XOLOX Response'
            }
          },
          {
            id: 'template-1',
            type: 'send_template',
            position: { x: 250, y: 350 },
            data: { 
              template: templateName,
              languageCode: 'en_US',
              components: [
                {
                  type: 'header',
                  parameters: [
                    {
                      type: 'image',
                      image: { id: mediaId }
                    }
                  ]
                }
              ]
            }
          }
        ],
        edges: [
          { id: 'trigger-to-xolox', source: 'trigger-1', target: 'xolox-1' },
          { id: 'xolox-to-assign', source: 'xolox-1', target: 'assign-1', sourceHandle: 'success' },
          { id: 'assign-to-template', source: 'assign-1', target: 'template-1' }
        ]
      }
    };

    console.log('--- CREATING WORKFLOW ---');
    console.log(`Template: ${templateName}`);
    console.log(`Media ID: ${mediaId}`);

    // Delete existing with same name for clean start
    await client.query("DELETE FROM workflows WHERE name = 'XOLOX CRM Auto-Lead & Template'");
    
    const res = await client.query(`
      INSERT INTO workflows (id, name, status, steps, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
      RETURNING id
    `, [workflow.name, workflow.status, JSON.stringify(workflow.steps)]);

    console.log(`✅ Workflow Created! ID: ${res.rows[0].id}`);
    console.log(`\nAutomation LIVE for: Trigger(New Contact) -> XOLOX API -> Auto-Assign(Harshita) -> Image Template`);
  } catch (e) {
    console.error('❌ Failed to create workflow:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
create();
