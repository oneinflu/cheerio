'use strict';
const db = require('../db');

async function seedInstagram() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Create Instagram Channel
    const channelRes = await client.query(`
      INSERT INTO channels (id, type, name, external_id, config, created_at)
      VALUES 
      (gen_random_uuid(), 'instagram', 'Demo Instagram', 'inst_12345', '{}', NOW())
      ON CONFLICT (type, external_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const channelId = channelRes.rows[0].id;
    console.log('Instagram Channel ID:', channelId);

    // 2. Create Instagram Contact
    const contactRes = await client.query(`
      INSERT INTO contacts (id, channel_id, external_id, display_name, created_at, updated_at)
      VALUES 
      (gen_random_uuid(), $1, 'insta_user_1', 'Instagram Fan', NOW(), NOW())
      ON CONFLICT (channel_id, external_id) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id
    `, [channelId]);
    const contactId = contactRes.rows[0].id;
    console.log('Instagram Contact ID:', contactId);

    // 3. Create Conversation
    const convRes = await client.query(`
      INSERT INTO conversations (id, channel_id, contact_id, status, last_message_at, created_at, updated_at)
      VALUES 
      (gen_random_uuid(), $1, $2, 'open', NOW(), NOW(), NOW())
      RETURNING id
    `, [channelId, contactId]);
    const convId = convRes.rows[0].id;
    console.log('Instagram Conversation ID:', convId);

    // 4. Create Messages
    await client.query(`
      INSERT INTO messages (id, conversation_id, channel_id, direction, content_type, text_body, delivery_status, created_at)
      VALUES 
      (gen_random_uuid(), $1, $2, 'inbound', 'text', 'Love your posts! 😍', NULL, NOW() - INTERVAL '5 minutes'),
      (gen_random_uuid(), $1, $2, 'outbound', 'text', 'Thanks for the love! ❤️', 'read', NOW() - INTERVAL '1 minute')
    `, [convId, channelId]);

    await client.query('COMMIT');
    console.log('Seeding complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
    process.exit();
  }
}

seedInstagram();
