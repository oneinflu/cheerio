require('dotenv').config();
const { triggerWorkflowsForEvent } = require('./src/services/workflows');

// Mock data for a new lead
const phoneNumber = '919182151640'; 
const context = {
  name: 'Test Suurya',
  course: 'CPA',
  mobile: phoneNumber,
  email: 'test@example.com'
};

console.log(`🚀 Manually triggering 'new_contact' event for ${phoneNumber}...`);

triggerWorkflowsForEvent('new_contact', phoneNumber, context)
  .then(() => {
    console.log('✅ Trigger signal sent. Check logs for WorkflowRunner execution.');
    // Keep alive briefly to see any immediate console logs if possible
    setTimeout(() => process.exit(0), 10000); 
  })
  .catch(err => {
    console.error('❌ Trigger failed:', err.message);
    process.exit(1);
  });
