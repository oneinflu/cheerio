'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');
const flowCrypto = require('../src/utils/flowCrypto');

async function main() {
  try {
    console.log('Generating RSA 2048 key pair...');
    const { publicKey, privateKey } = flowCrypto.generateKeyPair();
    
    console.log('Saving keys to database...');
    await db.query(
      `INSERT INTO whatsapp_flow_settings (public_key, private_key) VALUES ($1, $2)`,
      [publicKey, privateKey]
    );

    console.log('\n✅ Keys generated and saved successfully!');
    console.log('\n📝 PUBLIC KEY (Upload this to WhatsApp Manager):');
    console.log('--------------------------------------------------');
    console.log(publicKey);
    console.log('--------------------------------------------------');
    
    console.log('\n👉 Next Steps:');
    console.log('1. Go to WhatsApp Manager > Account Tools > Flows.');
    console.log('2. Upload the Public Key above.');
    console.log('3. Set your Endpoint URI to: https://<YOUR_DOMAIN>/webhooks/flow');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
