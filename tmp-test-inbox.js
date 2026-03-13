const svc = require('./backend/src/services/inbox');

async function test() {
  const teamId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';
  const userId = '691ec8b6567a2c0b4b861433';
  const userRole = 'quality_manager';
  
  const res = await svc.listConversations(teamId, userId, userRole, 'all');
  console.log("Conversations found for quality_manager:", res.length);
  process.exit(0);
}

test().catch(console.error);
