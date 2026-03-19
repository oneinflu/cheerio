require('dotenv').config();
const razorpay = require('./src/services/razorpay');

async function test() {
  console.log('--- Razorpay Integration Test ---');
  try {
    const link = await razorpay.createPaymentLink({
      amount: 499, // ₹499
      description: 'Test Course Payment',
      contact: '9182151640',
      email: 'test@example.com',
      notes: {
        test_mode: 'true',
        source: 'manual_test_script'
      }
    });

    console.log('✅ Success! Payment Link Created:');
    console.log('ID:', link.id);
    console.log('URL:', link.short_url);
    console.log('\nSteps to verify:');
    console.log('1. Open the URL in a browser.');
    console.log('2. Complete the payment (use Razorpay Test Mode card details).');
    console.log('3. If you have webhooks configured, they will hit your backend.');
  } catch (err) {
    console.error('❌ Failed to create link:', err.message);
  }
}

test();
