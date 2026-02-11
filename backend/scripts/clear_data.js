'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../db');

async function clearData() {
  try {
    console.log('Clearing transactional data (chats, contacts, notes, conversations)...');
    
    // We use TRUNCATE with CASCADE to clear tables and their dependents.
    // We preserve 'users', 'teams', 'team_members', 'channels' and 'workflows' as they are configuration.
    
    await db.query(`
      TRUNCATE TABLE 
        contacts, 
        conversations,
        messages,
        staff_notes,
        conversation_assignments,
        pinned_conversations,
        attachments,
        audit_logs
      CASCADE;
    `);
    
    console.log('Data cleared successfully.');
  } catch (err) {
    console.error('Failed to clear data:', err);
    process.exit(1);
  } finally {
    await db.close();
  }
}

clearData();
