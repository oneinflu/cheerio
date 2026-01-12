'use strict';
require('dotenv').config(); // Load environment variables
const db = require('../db');

const mode = (process.argv[2] || 'seed').toLowerCase();

async function clearConversationsData() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE
        attachments,
        staff_notes,
        conversation_assignments,
        messages,
        conversations,
        contacts,
        channels,
        audit_logs
      CASCADE
    `);
    await client.query('COMMIT');
    console.log('Successfully cleared conversations/messages/channels data.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Clear failed:', err);
  } finally {
    client.release();
    process.exit();
  }
}

async function seedRefreshData() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    console.log('Starting refresh seed...');

    // 1. Get or Create Channels
    // WhatsApp
    let waChannelId;
    const waRes = await client.query(`
      INSERT INTO channels (id, type, name, external_id, config, created_at)
      VALUES (gen_random_uuid(), 'whatsapp', 'Main WhatsApp', 'wa_main_1', '{}', NOW())
      ON CONFLICT (type, external_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    waChannelId = waRes.rows[0].id;

    // Instagram
    let igChannelId;
    const igRes = await client.query(`
      INSERT INTO channels (id, type, name, external_id, config, created_at)
      VALUES (gen_random_uuid(), 'instagram', 'Marketing Insta', 'ig_marketing_1', '{}', NOW())
      ON CONFLICT (type, external_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    igChannelId = igRes.rows[0].id;

    // 2. Define 5 new conversations data
    const newConversations = [
      {
        channelId: waChannelId,
        contactName: 'Alice Freeman',
        contactExtId: 'wa_alice_99',
        status: 'open',
        messages: [
          { dir: 'inbound', text: 'Hi, I saw your catalog. Do you have the summer collection?', time: '2 hours' },
          { dir: 'outbound', text: 'Yes Alice! Sending you the brochure now.', time: '1 hour' }
        ]
      },
      {
        channelId: waChannelId,
        contactName: 'Bob Builder',
        contactExtId: 'wa_bob_88',
        status: 'open',
        messages: [
          { dir: 'inbound', text: 'Urgent: My order #12345 hasn\'t arrived yet.', time: '30 minutes' }
        ]
      },
      {
        channelId: igChannelId,
        contactName: 'Sarah Style',
        contactExtId: 'ig_sarah_77',
        status: 'open',
        messages: [
          { dir: 'inbound', text: 'Collab?', time: '1 day' },
          { dir: 'outbound', text: 'Hey Sarah, send us your portfolio!', time: '20 hours' },
          { dir: 'inbound', text: 'Sure, checking it now.', time: '5 minutes' }
        ]
      },
      {
        channelId: igChannelId,
        contactName: 'Mike Tech',
        contactExtId: 'ig_mike_66',
        status: 'closed',
        messages: [
          { dir: 'inbound', text: 'Is the API down?', time: '2 days' },
          { dir: 'outbound', text: 'No, it was maintenance. All good now.', time: '1 day' },
          { dir: 'inbound', text: 'Thanks!', time: '1 day' }
        ]
      },
      {
        channelId: waChannelId,
        contactName: 'VIP Client',
        contactExtId: 'wa_vip_55',
        status: 'open',
        messages: [
          { dir: 'inbound', text: 'I need to renew my subscription immediately.', time: '10 minutes' }
        ]
      }
    ];

    // 3. Insert Data
    for (const conv of newConversations) {
      // Create Contact
      const contactRes = await client.query(`
        INSERT INTO contacts (id, channel_id, external_id, display_name, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
        ON CONFLICT (channel_id, external_id) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id
      `, [conv.channelId, conv.contactExtId, conv.contactName]);
      const contactId = contactRes.rows[0].id;

      // Create Conversation
      const convRes = await client.query(`
        INSERT INTO conversations (id, channel_id, contact_id, status, last_message_at, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW(), NOW())
        RETURNING id
      `, [conv.channelId, contactId, conv.status]);
      const conversationId = convRes.rows[0].id;

      // Create Messages
      for (const msg of conv.messages) {
        let interval = msg.time || '1 minute';
        await client.query(`
          INSERT INTO messages (id, conversation_id, channel_id, direction, content_type, text_body, delivery_status, created_at)
          VALUES (gen_random_uuid(), $1, $2, $3, 'text', $4, $5, NOW() - $6::interval)
        `, [
          conversationId, 
          conv.channelId, 
          msg.dir, 
          msg.text, 
          msg.dir === 'outbound' ? 'read' : null,
          interval
        ]);
      }
    }

    await client.query('COMMIT');
    console.log('Successfully added 5 new conversations!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
  } finally {
    client.release();
    process.exit();
  }
}

if (mode === 'clear' || mode === 'reset') {
  clearConversationsData();
} else {
  seedRefreshData();
}
