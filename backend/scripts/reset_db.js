const { runMigrations } = require('./migrate');
const db = require('../db');

async function reset() {
  try {
    console.log('Dropping public schema...');
    // Drop and recreate public schema to wipe all data and types
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;');
    
    console.log('Schema dropped. Running migrations...');
    await runMigrations();
    
    console.log('Reset complete.');
  } catch (err) {
    console.error('Reset failed:', err);
    process.exit(1);
  } finally {
    await db.close();
  }
}

reset();
