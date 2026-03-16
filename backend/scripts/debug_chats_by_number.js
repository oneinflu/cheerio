#!/usr/bin/env node
'use strict';

/**
 * Debug script to verify incoming chats are properly associated with phone numbers
 * Usage: node scripts/debug_chats_by_number.js
 */

const db = require('../db');

async function main() {
  try {
    console.log('\n=== DEBUGGING CHATS BY PHONE NUMBER ===\n');

    // 1. Check all channels and their phone numbers
    console.log('1. ALL CHANNELS IN DATABASE:');
    const channelsRes = await db.query(`
      SELECT id, type, external_id, name, active, created_at
      FROM channels
      ORDER BY created_at DESC
      LIMIT 20
    `);
    console.log(`Found ${channelsRes.rowCount} channels:`);
    channelsRes.rows.forEach(ch => {
      console.log(`  - ${ch.type} | ${ch.external_id} | ${ch.name} | Active: ${ch.active}`);
    });

    // 2. Check WhatsApp settings
    console.log('\n2. WHATSAPP SETTINGS IN DATABASE:');
    const settingsRes = await db.query(`
      SELECT team_id, phone_number_id, business_account_id, display_phone_number, is_active
      FROM whatsapp_settings
      ORDER BY created_at DESC
    `);
    console.log(`Found ${settingsRes.rowCount} settings:`);
    settingsRes.rows.forEach(s => {
      console.log(`  - Team: ${s.team_id} | Phone: ${s.phone_number_id} | Display: ${s.display_phone_number} | Active: ${s.is_active}`);
    });

    // 3. Check conversations and their channels
    console.log('\n3. CONVERSATIONS AND THEIR CHANNELS:');
    const convRes = await db.query(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        ch.external_id as phone_number_id,
        ch.type,
        ct.display_name,
        ct.external_id as contact_wa_id,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      JOIN channels ch ON ch.id = c.channel_id
      JOIN contacts ct ON ct.id = c.contact_id
      ORDER BY c.created_at DESC
      LIMIT 20
    `);
    console.log(`Found ${convRes.rowCount} conversations:`);
    convRes.rows.forEach(c => {
      console.log(`  - Conv: ${c.id.substring(0, 8)}... | Phone: ${c.phone_number_id} | Contact: ${c.contact_wa_id} | Messages: ${c.message_count} | Status: ${c.status}`);
    });

    // 4. Check for each phone number, how many conversations
    console.log('\n4. CONVERSATIONS PER PHONE NUMBER:');
    const perPhoneRes = await db.query(`
      SELECT 
        ch.external_id as phone_number_id,
        COUNT(DISTINCT c.id) as conversation_count,
        COUNT(DISTINCT m.id) as message_count
      FROM channels ch
      LEFT JOIN conversations c ON c.channel_id = ch.id
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE ch.type = 'whatsapp'
      GROUP BY ch.external_id
      ORDER BY conversation_count DESC
    `);
    console.log(`Phone number breakdown:`);
    perPhoneRes.rows.forEach(row => {
      console.log(`  - ${row.phone_number_id}: ${row.conversation_count} conversations, ${row.message_count} messages`);
    });

    // 5. Test the inbox query for each phone
    console.log('\n5. TESTING INBOX QUERY FOR EACH PHONE:');
    const phonesRes = await db.query(`
      SELECT DISTINCT ch.external_id
      FROM channels ch
      WHERE ch.type = 'whatsapp'
    `);
    
    for (const phoneRow of phonesRes.rows) {
      const phoneId = phoneRow.external_id;
      const testRes = await db.query(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM conversations c
        JOIN channels ch ON ch.id = c.channel_id
        WHERE ch.external_id = $1
      `, [phoneId]);
      console.log(`  - Phone ${phoneId}: ${testRes.rows[0].count} conversations`);
    }

    // 6. Check environment variables
    console.log('\n6. ENVIRONMENT VARIABLES:');
    console.log(`  - WHATSAPP_PHONE_NUMBER_ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID || 'NOT SET'}`);
    console.log(`  - WHATSAPP_BUSINESS_ACCOUNT_ID: ${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'NOT SET'}`);
    console.log(`  - WHATSAPP_TOKEN: ${process.env.WHATSAPP_TOKEN ? '***SET***' : 'NOT SET'}`);

    console.log('\n=== END DEBUG ===\n');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
