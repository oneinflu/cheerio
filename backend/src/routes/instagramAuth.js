'use strict';
const express = require('express');
const router = express.Router();

/**
 * GET /api/auth/instagram/callback
 * Endpoint for Instagram/Facebook Business Login Redirect.
 * 
 * When setting up "Log in with Facebook" or "Instagram Business Login",
 * you need to provide a Valid OAuth Redirect URI.
 * This endpoint serves as that target.
 */
router.get('/instagram/callback', (req, res) => {
  const { code, state, error, error_reason, error_description } = req.query;

  console.log('[Instagram Auth] Callback received:', req.query);

  if (error) {
    console.error('[Instagram Auth] Error:', error, error_reason, error_description);
    return res.status(400).send(`Instagram Login Error: ${error_description}`);
  }

  if (code) {
    // In a real implementation, you would exchange this 'code' for an access token
    // using the Graph API (GET /oauth/access_token).
    // For now, we just acknowledge the redirect so the user doesn't see a 404.
    
    console.log('[Instagram Auth] Authorization Code received:', code);
    
    // You can redirect the user back to your frontend success page or show a success message.
    // Example: res.redirect('https://your-frontend.com/settings?instagram_connected=true');
    
    return res.send(`
      <html>
        <body>
          <h1>Login Successful</h1>
          <p>You have successfully authenticated with Instagram/Facebook.</p>
          <p>Authorization Code: ${code}</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
  }

  res.status(400).send('No code or error received.');
});

module.exports = router;
