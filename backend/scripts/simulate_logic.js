
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require("../db");

async function run() {
  try {
    // 1. Create a dummy conversation first (since we cleared data)
    // We need a channel and contact first.
    
    // Create Channel
    const channelRes = await db.query(`
      INSERT INTO channels (id, type, name, external_id, config, active)
      VALUES (gen_random_uuid(), 'whatsapp', 'Test Channel', '1234567890', '{}', true)
      RETURNING id
    `);
    const channelId = channelRes.rows[0].id;
    
    // Create Contact
    const contactRes = await db.query(`
      INSERT INTO contacts (id, channel_id, external_id, display_name)
      VALUES (gen_random_uuid(), $1, '919182151640', 'Test User')
      RETURNING id
    `, [channelId]);
    const contactId = contactRes.rows[0].id;
    
    // Create Conversation
    const convRes = await db.query(`
      INSERT INTO conversations (id, channel_id, contact_id, status)
      VALUES (gen_random_uuid(), $1, $2, 'open')
      RETURNING id
    `, [channelId, contactId]);
    const conversationId = convRes.rows[0].id;
    
    console.log('Created conversation:', conversationId);

    // 2. Run the assignment logic
    const leadData = {
      assignedTo: {
        email: "shoaib.b@northstaracad.com"
      }
    };
    
    console.log('Simulating assignment for:', leadData.assignedTo.email);

    if (leadData?.assignedTo?.email) {
      const email = leadData.assignedTo.email;
      
      // Find user by email
      const userRes = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userRes.rows.length > 0) {
        const userId = userRes.rows[0].id;
        console.log('Found user:', userId);
        
        // Find team
        const teamRes = await db.query('SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1', [userId]);
        if (teamRes.rows.length > 0) {
          const teamId = teamRes.rows[0].team_id;
          console.log('Found team:', teamId);
          
          // Check if already assigned
          const checkRes = await db.query(
            'SELECT 1 FROM conversation_assignments WHERE conversation_id = $1 AND released_at IS NULL', 
            [conversationId]
          );
          
          if (checkRes.rowCount === 0) {
             await db.query(
               `INSERT INTO conversation_assignments (id, conversation_id, team_id, assignee_user_id, claimed_at)
                VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
               [conversationId, teamId, userId]
             );
             console.log(`Auto-assigned conversation ${conversationId} to user ${userId} (${email})`);
          } else {
             console.log(`Conversation ${conversationId} already assigned.`);
          }
        } else {
          console.log(`User ${email} has no team.`);
        }
      } else {
        console.log(`User email ${email} not found.`);
      }
    }
    
  } catch (e) {
    console.error(e);
  } finally {
    await db.close();
  }
}
run();
