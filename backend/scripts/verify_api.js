'use strict';
const jwt = require('jsonwebtoken');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_key_12345';
const PORT = 3001;

async function verify() {
  try {
    // 1. Generate Token for Admin (sees all)
    const token = jwt.sign(
      { 
        id: 'admin_user', 
        role: 'admin',
        teamIds: ['team_1'] 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Call Inbox API
    const url = `http://localhost:${PORT}/api/inbox?filter=open`;
    console.log(`Fetching ${url}...`);
    
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // 3. Check for leadId
    const conversations = res.data.conversations || [];
    const targetConv = conversations.find(c => c.id === 'd65a7ef3-d7d9-4876-ba63-22aa2b8bf866');

    if (targetConv) {
      console.log('Found target conversation:', targetConv);
      if (targetConv.leadId) {
        console.log('SUCCESS: leadId is present:', targetConv.leadId);
      } else {
        console.log('FAILURE: leadId is missing or null.');
      }
    } else {
      console.log('Target conversation not found in inbox. (Might be closed or filtered?)');
      console.log('First 3 conversations:', conversations.slice(0, 3));
    }

  } catch (err) {
    console.error('Error verifying API:', err.message);
    if (err.response) {
        console.error('Response data:', err.response.data);
    }
  }
}

verify();
