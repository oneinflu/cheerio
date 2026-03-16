#!/usr/bin/env node
'use strict';

/**
 * Debug script to diagnose template loading issues
 * Usage: node scripts/debug_templates.js [phoneNumberId]
 */

const db = require('../db');
const whatsappClient = require('../src/integrations/meta/whatsappClient');
const waConfig = require('../src/utils/whatsappConfig');

async function main() {
  try {
    const phoneNumberId = process.argv[2] || null;
    
    console.log('\n=== DEBUGGING TEMPLATES ===\n');

    // 1. Check environment variables
    console.log('1. ENVIRONMENT VARIABLES:');
    console.log(`  - WHATSAPP_PHONE_NUMBER_ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID || 'NOT SET'}`);
    console.log(`  - WHATSAPP_BUSINESS_ACCOUNT_ID: ${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'NOT SET'}`);
    console.log(`  - WHATSAPP_TOKEN: ${process.env.WHATSAPP_TOKEN ? '***SET***' : 'NOT SET'}`);
    console.log(`  - USE_MOCK_WHATSAPP: ${process.env.USE_MOCK_WHATSAPP || 'NOT SET'}`);

    // 2. Check database settings
    console.log('\n2. DATABASE WHATSAPP SETTINGS:');
    const settingsRes = await db.query(`
      SELECT phone_number_id, business_account_id, permanent_token, display_phone_number, is_active
      FROM whatsapp_settings
      ORDER BY created_at DESC
    `);
    console.log(`Found ${settingsRes.rowCount} settings:`);
    settingsRes.rows.forEach(s => {
      console.log(`  - Phone: ${s.phone_number_id}`);
      console.log(`    WABA ID: ${s.business_account_id}`);
      console.log(`    Display: ${s.display_phone_number}`);
      console.log(`    Active: ${s.is_active}`);
      console.log(`    Token: ${s.permanent_token ? '***SET***' : 'NOT SET'}`);
    });

    // 3. Get config for specific phone or all
    console.log('\n3. RESOLVED CONFIGS:');
    let configs = [];
    if (phoneNumberId) {
      console.log(`  Fetching config for phone: ${phoneNumberId}`);
      const config = await waConfig.getConfigByPhone(phoneNumberId);
      configs = [config];
    } else {
      console.log(`  Fetching all configs for team: default`);
      configs = await waConfig.getAllConfigs('default');
      if (configs.length === 0) {
        console.log(`  No configs found, using fallback`);
        configs = [{
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
          token: process.env.WHATSAPP_TOKEN,
          isCustom: false
        }];
      }
    }

    configs.forEach((config, idx) => {
      console.log(`  Config ${idx + 1}:`);
      console.log(`    Phone: ${config.phoneNumberId}`);
      console.log(`    WABA ID: ${config.businessAccountId}`);
      console.log(`    Token: ${config.token ? '***SET***' : 'NOT SET'}`);
      console.log(`    Custom: ${config.isCustom}`);
    });

    // 4. Test template fetching for each config
    console.log('\n4. TESTING TEMPLATE FETCH:');
    for (const config of configs) {
      const wabaId = config.businessAccountId;
      if (!wabaId) {
        console.log(`  ⚠️  WABA ID is empty for phone ${config.phoneNumberId}`);
        continue;
      }

      console.log(`\n  Testing WABA: ${wabaId} (Phone: ${config.phoneNumberId})`);
      try {
        console.log(`    Calling: whatsappClient.getTemplates(${wabaId}, 100, config)`);
        const resp = await whatsappClient.getTemplates(wabaId, 100, config);
        
        if (resp && resp.data && resp.data.data) {
          const templates = resp.data.data;
          console.log(`    ✅ SUCCESS: Found ${templates.length} templates`);
          if (templates.length > 0) {
            console.log(`    First 3 templates:`);
            templates.slice(0, 3).forEach(t => {
              console.log(`      - ${t.name} (${t.status})`);
            });
          }
        } else {
          console.log(`    ⚠️  Unexpected response format:`, resp);
        }
      } catch (err) {
        console.log(`    ❌ ERROR: ${err.message}`);
        if (err.response) {
          console.log(`    Response:`, JSON.stringify(err.response, null, 2));
        }
      }
    }

    // 5. Check local templates
    console.log('\n5. LOCAL TEMPLATES:');
    const localRes = await db.query('SELECT name, language, status FROM whatsapp_templates LIMIT 10');
    console.log(`Found ${localRes.rowCount} local templates:`);
    localRes.rows.forEach(t => {
      console.log(`  - ${t.name} (${t.language}, ${t.status})`);
    });

    // 6. Check template settings (starred)
    console.log('\n6. STARRED TEMPLATES:');
    const starredRes = await db.query('SELECT template_name FROM template_settings WHERE is_starred = TRUE');
    console.log(`Found ${starredRes.rowCount} starred templates:`);
    starredRes.rows.forEach(t => {
      console.log(`  - ${t.template_name}`);
    });

    console.log('\n=== END DEBUG ===\n');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
