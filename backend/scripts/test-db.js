
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000, // 5 second timeout
});

console.log('Testing connection to:', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':****@')); // Hide password

(async () => {
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('✅ Connection successful!');
    const res = await client.query('SELECT NOW()');
    console.log('Database time:', res.rows[0].now);
    await client.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    if (err.message.includes('ETIMEDOUT')) {
        console.log('\nPossible causes:\n1. DigitalOcean Trusted Sources (Firewall) is blocking your IP.\n2. Wrong Port/Host.\n3. Network connectivity issues.');
    }
    process.exit(1);
  }
})();
