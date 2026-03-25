'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const db = require('../db');

async function runSQLFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
}

async function runMigrations() {
  const client = await db.getClient();
  try {
    // Check if tables already exist to avoid overwriting data
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE  table_schema = 'public'
        AND    table_name   = 'users'
      );
    `);

    const tablesExist = res.rows[0].exists;
    if (tablesExist) {
      // Check if we need to upgrade from UUID to TEXT ids (schema change)
      const idTypeRes = await client.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'id'
      `);

      const isTextId = idTypeRes.rows[0] && idTypeRes.rows[0].data_type === 'text';

      if (!isTextId) {
        console.log('[migrate] Detected old schema (UUID IDs). Re-running migration to update to TEXT IDs...');
        // Fall through to run migration
      } else {
        console.log('[migrate] Tables already exist and schema matches.');

        // Check if password_hash column exists
        const colRes = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='users' AND column_name='password_hash'
        `);

        if (colRes.rowCount === 0) {
          console.log('[migrate] Adding password_hash column...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0002_add_password_to_users.sql'));
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'seeds', '002_update_passwords.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied password migration.');
        }

        const deliveryAcceptedRes = await client.query(
          `
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'delivery_status'
            AND e.enumlabel = 'accepted'
          LIMIT 1
          `
        );
        if (deliveryAcceptedRes.rowCount === 0) {
          console.log('[migrate] Adding accepted to delivery_status enum...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0021_add_delivery_status_accepted.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied delivery_status accepted migration.');
        }

        // Check if lead_id column exists in conversations
        const leadColRes = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='conversations' AND column_name='lead_id'
        `);

        if (leadColRes.rowCount === 0) {
          console.log('[migrate] Adding lead_id column to conversations...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0003_add_lead_id_to_conversations.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied lead_id migration.');
        } else {
          console.log('[migrate] Schema up to date (lead_id exists).');
        }

        // Check if user FK constraint exists on conversation_assignments
        const fkRes = await client.query(`
          SELECT conname 
          FROM pg_constraint 
          WHERE conname = 'conversation_assignments_assignee_user_id_fkey'
        `);

        if (fkRes.rowCount > 0) {
          console.log('[migrate] Removing User FK constraints...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0004_remove_user_fk_constraints.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Removed User FK constraints.');
        } else {
          console.log('[migrate] User FK constraints already removed.');
        }

        // Check if team FK constraint exists
        const teamFkRes = await client.query(`
          SELECT conname 
          FROM pg_constraint 
          WHERE conname = 'conversation_assignments_team_id_fkey'
        `);

        if (teamFkRes.rowCount > 0) {
          console.log('[migrate] Relaxing Team constraints...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0005_relax_team_constraints.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Relaxed Team constraints.');
        } else {
          console.log('[migrate] Team constraints already relaxed.');
        }

        // Check if template_settings table exists
        const templateSettingsRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'template_settings'
          );
        `);

        if (!templateSettingsRes.rows[0].exists) {
          console.log('[migrate] Adding template_settings table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0006_create_template_settings.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied template_settings migration.');
        } else {
          console.log('[migrate] template_settings table already exists.');
        }

        const rulesTableRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'automation_rules'
          );
        `);

        if (!rulesTableRes.rows[0].exists) {
          console.log('[migrate] Adding automation_rules table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0007_create_automation_rules.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied automation_rules migration.');
        } else {
          console.log('[migrate] automation_rules table already exists.');
        }

        // Check for attributes column in users
        const attributesColRes = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name='users' AND column_name='attributes'
        `);
        if (attributesColRes.rowCount === 0) {
          console.log('[migrate] Adding attributes column and agent assignment settings...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0012_add_agent_assignment.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied agent assignment migration.');
        } else {
          console.log('[migrate] users.attributes column already exists.');
        }

        const leadStagesRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'lead_stages'
          );
        `);

        if (!leadStagesRes.rows[0].exists) {
          console.log('[migrate] Adding lead_stages and team_working_hours tables...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0008_lead_stages_working_hours.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied lead_stages and team_working_hours migration.');
        } else {
          console.log('[migrate] lead_stages and team_working_hours tables already exist.');
        }

        // Check if lead_stage_id column exists in conversations
        const leadStageColRes = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name='conversations' AND column_name='lead_stage_id'
        `);

        if (leadStageColRes.rowCount === 0) {
          console.log('[migrate] Adding lead_stage_id column to conversations...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0019_add_lead_stage_to_conversations.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied conversations lead_stage_id migration.');
        } else {
          console.log('[migrate] conversations lead_stage_id column already exists.');
        }

        const flowsTableRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'whatsapp_flows'
          );
        `);

        if (!flowsTableRes.rows[0].exists) {
          console.log('[migrate] Adding whatsapp_flows table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0009_whatsapp_flows.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied whatsapp_flows migration.');
        } else {
          console.log('[migrate] whatsapp_flows table already exists.');

          // Check if status column exists in whatsapp_flows
          const flowsStatusRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='whatsapp_flows' AND column_name='status'
          `);

          if (flowsStatusRes.rowCount === 0) {
            console.log('[migrate] Adding status column to whatsapp_flows...');
            await client.query('BEGIN');
            await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0010_add_status_to_whatsapp_flows.sql'));
            await client.query('COMMIT');
            console.log('[migrate] Applied whatsapp_flows status migration.');
          } else {
            console.log('[migrate] whatsapp_flows status column already exists.');
          }
        }

        // lead_stage_workflows mapping table
        const stageWorkflowsRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'lead_stage_workflows'
          );
        `);
        if (!stageWorkflowsRes.rows[0].exists) {
          console.log('[migrate] Adding lead_stage_workflows table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0020_lead_stage_workflows.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied lead_stage_workflows migration.');
        } else {
          console.log('[migrate] lead_stage_workflows table already exists.');
        }
        const flowSettingsRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'whatsapp_flow_settings'
          );
        `);

        if (!flowSettingsRes.rows[0].exists) {
          console.log('[migrate] Adding whatsapp_flow_settings table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0011_create_flow_settings.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied whatsapp_flow_settings migration.');
        } else {
          console.log('[migrate] whatsapp_flow_settings table already exists.');
        }

        const labelsTableRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'contact_labels'
          );
        `);

        if (!labelsTableRes.rows[0].exists) {
          console.log('[migrate] Adding contact_labels and contact_label_maps tables...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0002_contact_labels.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied contact_labels migration.');
        } else {
          console.log('[migrate] contact_labels tables already exist.');
        }

        const campaignsTableRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'campaigns'
          );
        `);

        if (!campaignsTableRes.rows[0].exists) {
          console.log('[migrate] Adding campaigns and campaign_logs tables...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0012_campaigns.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied campaigns migration.');
        } else {
          console.log('[migrate] campaigns table already exists.');
        }

        const emailTemplatesRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'email_templates'
          );
        `);
        if (!emailTemplatesRes.rows[0].exists) {
          console.log('[migrate] Adding email_templates table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0014_email_templates.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied email_templates migration.');
        } else {
          console.log('[migrate] email_templates table already exists.');
        }

        // webhook_events table
        const webhookEventsRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'webhook_events'
          );
        `);
        if (!webhookEventsRes.rows[0].exists) {
          console.log('[migrate] Adding webhook_events table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0013_webhook_events.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied webhook_events migration.');
        } else {
          console.log('[migrate] webhook_events table already exists.');
        }

        const emailDesignColRes = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name='email_templates' AND column_name='design'
        `);
        if (emailDesignColRes.rowCount === 0) {
          console.log('[migrate] Adding design column to email_templates...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0017_email_templates_design.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied email_templates design column migration.');
        } else {
          console.log('[migrate] email_templates.design column already exists.');
        }

        // 0014 – relax webhook_events.workflow_id to TEXT (was UUID+FK, caused silent drops)
        const whCol = await client.query(`
          SELECT data_type FROM information_schema.columns
          WHERE table_name='webhook_events' AND column_name='workflow_id'
        `);
        if (whCol.rows[0]?.data_type === 'uuid') {
          console.log('[migrate] Relaxing webhook_events.workflow_id to TEXT...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0014_fix_webhook_events.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0014_fix_webhook_events migration.');
        } else {
          console.log('[migrate] webhook_events.workflow_id is already TEXT. OK.');
        }

        // 0015 – csat_scores table
        const csatTableRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'csat_scores'
          );
        `);
        if (!csatTableRes.rows[0].exists) {
          console.log('[migrate] Adding csat_scores table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0015_csat_scores.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0015_csat_scores migration.');
        } else {
          console.log('[migrate] csat_scores table already exists.');
        }

        // 0016 – payment_requests table
        const paymentTableRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'payment_requests'
          );
        `);
        if (!paymentTableRes.rows[0].exists) {
          console.log('[migrate] Adding payment_requests table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0016_payment_requests.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0016_payment_requests migration.');
        } else {
          console.log('[migrate] payment_requests table already exists.');
        }

        // 0018 – whatsapp_templates table
        const waTemplatesRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'whatsapp_templates'
          );
        `);
        if (!waTemplatesRes.rows[0].exists) {
          console.log('[migrate] Adding whatsapp_templates table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0018_whatsapp_templates.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0018_whatsapp_templates migration.');
        } else {
          console.log('[migrate] whatsapp_templates table already exists.');
        }

        // 0020 – ai_agent_rag table
        const aiAgentRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'ai_agent_config'
          );
        `);
        if (!aiAgentRes.rows[0].exists) {
          console.log('[migrate] Adding AI Agent tables...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0020_ai_agent_rag.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0020_ai_agent_rag migration.');
        } else {
          console.log('[migrate] AI Agent tables already exist.');
        }

        // 0022 – whatsapp_settings table
        const waSettingsRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'whatsapp_settings'
          );
        `);
        if (!waSettingsRes.rows[0].exists) {
          console.log('[migrate] Adding whatsapp_settings table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0022_whatsapp_settings.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0022_whatsapp_settings migration.');
        } else {
          console.log('[migrate] whatsapp_settings table already exists.');
        }

        // 0023 – allow multiple whatsapp numbers
        const multiNumberCheck = await client.query(`
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'whatsapp_settings' AND constraint_name = 'whatsapp_settings_team_phone_unique'
        `);
        if (multiNumberCheck.rowCount === 0) {
          console.log('[migrate] Adding multi-number support to whatsapp_settings...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0023_allow_multiple_whatsapp_numbers.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0023_allow_multiple_whatsapp_numbers migration.');
        } else {
          console.log('[migrate] whatsapp_settings already supports multiple numbers.');
        }

        // 0024 – razorpay_settings table
        const rzpTableRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE  table_schema = 'public'
            AND    table_name   = 'razorpay_settings'
          );
        `);
        if (!rzpTableRes.rows[0].exists) {
          console.log('[migrate] Adding razorpay_settings table...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0024_razorpay_settings.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0024_razorpay_settings migration.');
        } else {
          console.log('[migrate] razorpay_settings table already exists.');
        }

        // 0025 – exotel_settings and exotel_call_logs tables
        const exotelSettingsRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE  table_schema = 'public'
            AND    table_name   = 'exotel_settings'
          );
        `);
        if (!exotelSettingsRes.rows[0].exists) {
          console.log('[migrate] Adding exotel_settings and exotel_call_logs tables...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0025_exotel_settings.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0025_exotel_settings migration.');
        } else {
          console.log('[migrate] exotel_settings table already exists.');
        }

        // 0026 – twilio_settings and twilio_logs tables
        const twilioSettingsRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE  table_schema = 'public'
            AND    table_name   = 'twilio_settings'
          );
        `);
        if (!twilioSettingsRes.rows[0].exists) {
          console.log('[migrate] Adding twilio_settings and twilio_logs tables...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0026_twilio_settings.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0026_twilio_settings migration.');
        } else {
          console.log('[migrate] twilio_settings table already exists.');
        }

        // 0027 – email_settings and email_messages tables
        const emailSettingsRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE  table_schema = 'public'
            AND    table_name   = 'email_settings'
          );
        `);
        if (!emailSettingsRes.rows[0].exists) {
          console.log('[migrate] Adding email_settings and email_messages tables...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0027_email_settings.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied 0027_email_settings migration.');
        } else {
          console.log('[migrate] email_settings table already exists.');
        }

        // --- NEW REPAIRS FOR WORKFLOWS AND TEMPLATES ---
        console.log('[migrate] Running automated repairs for messages extra columns/enums...');

        // 1. Add 'template' to the enum
        try {
          await client.query("ALTER TYPE message_content_type ADD VALUE IF NOT EXISTS 'template'");
          console.log('[migrate] ✅ Added "template" to message_content_type enum');
        } catch (e) {
          // Ignore if it fails because it's already there (Postgres doesn't support IF NOT EXISTS in all versions)
        }

        // 2. Ensure template_name column exists
        const msgColsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'");
        const msgCols = msgColsRes.rows.map(r => r.column_name);

        if (!msgCols.includes('template_name')) {
          console.log('[migrate] Adding template_name column to messages...');
          await client.query("ALTER TABLE messages ADD COLUMN template_name TEXT");
        }

        // 3. Rename/Add status and external_id if needed
        if (!msgCols.includes('external_message_id')) {
          if (msgCols.includes('external_id')) {
            await client.query("ALTER TABLE messages RENAME COLUMN external_id TO external_message_id");
            console.log('[migrate] Renamed external_id to external_message_id');
          } else {
            await client.query("ALTER TABLE messages ADD COLUMN external_message_id TEXT");
          }
        }

        if (!msgCols.includes('delivery_status')) {
          if (msgCols.includes('status')) {
            await client.query("ALTER TABLE messages RENAME COLUMN status TO delivery_status");
            console.log('[migrate] Renamed status to delivery_status');
          } else {
            await client.query("ALTER TABLE messages ADD COLUMN delivery_status TEXT DEFAULT 'accepted'");
          }
        }

        // Check if lead_stage column exists in contacts
        const contactLeadColRes = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='contacts' AND column_name='lead_stage'
        `);

        if (contactLeadColRes.rowCount === 0) {
          console.log('[migrate] Adding lead tracking columns to contacts...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0029_add_contact_lead_columns.sql'));
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0030_backfill_contact_columns.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied contact lead tracking and backfill migration.');
        } else {
          // Even if columns exist, run the backfill once to be sure
          console.log('[migrate] Contacts table lead schema exists. Ensuring backfill is complete...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0030_backfill_contact_columns.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Data backfill check finished.');
        }

        // Check if lead_status column exists in contacts
        const contactStatusColRes = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='contacts' AND column_name='lead_status'
        `);

        if (contactStatusColRes.rowCount === 0) {
          console.log('[migrate] Adding lead_status column to contacts...');
          await client.query('BEGIN');
          await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0031_add_contact_status.sql'));
          await client.query('COMMIT');
          console.log('[migrate] Applied contact lead_status migration.');
        }

        return;


      }
    }

    console.log('[migrate] Starting migration using DATABASE_URL');
    await client.query('BEGIN');
    await runSQLFile(client, path.join(__dirname, '..', 'db', 'migrations', '0001_meta_command_center.sql'));
    await client.query('COMMIT');
    console.log('[migrate] Migration applied successfully');

    // console.log('[seed] Applying seed data');
    // await client.query('BEGIN');
    // await runSQLFile(client, path.join(__dirname, '..', 'db', 'seeds', '001_demo_data.sql'));
    // await client.query('COMMIT');
    // console.log('[seed] Seed data applied successfully');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) { }
    console.error('[migrate] Error:', err.message);
    // If called from script, exit with error. If called from server, rethrow.
    if (require.main === module) {
      process.exit(1);
    } else {
      throw err;
    }
  } finally {
    client.release();
    // Only close pool if running as standalone script
    if (require.main === module) {
      await db.close();
    }
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
