'use strict';
// Use the existing db module to benefit from already configured pooling/ssl
const db = require('../db');

async function run() {
  console.log('--- Patching template_settings for Course Grouping ---');
  try {
    // 1. Add course_group column to template_settings if it doesn't exist
    await db.query(`
      ALTER TABLE template_settings 
      ADD COLUMN IF NOT EXISTS course_group VARCHAR(100);
    `);
    console.log('Column course_group added or already exists.');

    // 2. Initial auto-categorization based on naming convention
    await db.query(`
      UPDATE template_settings 
      SET course_group = 'CPA' 
      WHERE template_name ILIKE '%cpa%' AND (course_group IS NULL OR course_group = '');
    `);
    await db.query(`
      UPDATE template_settings 
      SET course_group = 'CMA US' 
      WHERE (template_name ILIKE '%cma%' OR template_name ILIKE '%cma_us%') AND (course_group IS NULL OR course_group = '');
    `);
    await db.query(`
      UPDATE template_settings 
      SET course_group = 'ACCA' 
      WHERE template_name ILIKE '%acca%' AND (course_group IS NULL OR course_group = '');
    `);
    await db.query(`
      UPDATE template_settings 
      SET course_group = 'EA' 
      WHERE template_name ILIKE '%ea%' AND (course_group IS NULL OR course_group = '');
    `);
    
    console.log('Auto-categorization completed.');
    console.log('--- Migration Completed Successfully ---');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

run();
