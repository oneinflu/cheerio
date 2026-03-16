# WhatsApp vs Telegram - Architecture Comparison

## Side-by-Side Comparison

### 1. SETUP & AUTHENTICATION

#### WhatsApp
```
1. Go to Meta Business Suite
2. Create WhatsApp Business Account
3. Get WABA ID and phone number
4. Generate access token via OAuth
5. Store in whatsapp_settings table
```

#### Telegram
```
1. Open Telegram app
2. Search @BotFather
3. Send /newbot
4. Get bot token
5. Store in telegram_settings table
```

### 2. WEBHOOK VERIFICATION

#### WhatsApp
```javascript
// Signature verification using HMAC-SHA256
const header = req.headers['x-hub-signature-256'];
const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET)
  .update(req.rawBody)
  .digest('hex');
if (header !== expected) return 403;
```

#### Telegram
```javascript
// Secret token verification
const secretToken = req.headers['x-telegram-bot-api-secret-token'];
const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (secretToken !== expectedSecret) return 403;
```

### 3. MESSAGE INGESTION

#### WhatsApp
```javascript
// Extract from Meta webhook
const phoneNumberId = metadata.phone_number_id;
const senderWaId = msg.from;
const messageId = msg.id;

// Upsert channel
INSERT INTO channels (type, external_id)
VALUES ('whatsapp', phoneNumberId)

// Upsert contact
INSERT INTO contacts (channel_id, external_id)
VALUES (channelId, senderWaId)
```

#### Telegram
```javascript
// Extract from Telegram webhook
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const userId = message.from.id;
const messageId = message.message_id;

// Upsert channel
INSERT INTO channels (type, external_id)
VALUES ('telegram', botToken)

// Upsert contact
INSERT INTO contacts (channel_id, external_id)
VALUES (channelId, userId)
```

### 4. MESSAGE TYPES

#### WhatsApp Supported
- ✅ Text
- ✅ Image
- ✅ Audio
- ✅ Document
- ✅ Video
- ✅ Sticker
- ✅ Location
- ✅ Contact
- ✅ Interactive (buttons, lists)
- ✅ Template messages

#### Telegram Supported
- ✅ Text
- ✅ Photo
- ✅ Audio
- ✅ Document
- ✅ Video
- ✅ Voice
- ✅ Sticker
- ✅ Location
- ✅ Contact
- ❌ Templates (not supported)
- ❌ Interactive buttons (limited)

### 5. OUTBOUND MESSAGING

#### WhatsApp
```javascript
// sendText
await whatsappClient.sendText(phoneNumberId, toWaId, text, config);

// sendMedia
await whatsappClient.sendMedia(phoneNumberId, toWaId, kind, linkOrId, caption, config);

// sendTemplate
await whatsappClient.sendTemplate(phoneNumberId, toWaId, name, languageCode, components, config);

// 24-hour window enforcement
if (lastInboundMessage < 24h) {
  // Only templates allowed
}
```

#### Telegram
```javascript
// sendText
await telegramClient.sendText(botToken, chatId, text);

// sendMedia
await telegramClient.sendPhoto(botToken, chatId, photoUrl, caption);
await telegramClient.sendDocument(botToken, chatId, docUrl, caption);
await telegramClient.sendAudio(botToken, chatId, audioUrl, caption);
await telegramClient.sendVideo(botToken, chatId, videoUrl, caption);

// No 24-hour window
// No templates
```

### 6. CONFIGURATION STORAGE

#### WhatsApp
```sql
CREATE TABLE whatsapp_settings (
    id UUID PRIMARY KEY,
    team_id TEXT,
    phone_number_id TEXT,
    business_account_id TEXT,
    permanent_token TEXT,
    display_phone_number TEXT,
    is_active BOOLEAN,
    UNIQUE(team_id, phone_number_id)
);
```

#### Telegram
```sql
CREATE TABLE telegram_settings (
    id UUID PRIMARY KEY,
    team_id TEXT,
    bot_token TEXT,
    bot_username TEXT,
    display_name TEXT,
    is_active BOOLEAN,
    UNIQUE(team_id, bot_token)
);
```

### 7. CHANNEL STORAGE

#### WhatsApp
```sql
-- Stored in channels table
INSERT INTO channels (type, external_id, name)
VALUES ('whatsapp', '921055841100882', '+91 205 584 1100882');
```

#### Telegram
```sql
-- Stored in channels table
INSERT INTO channels (type, external_id, name)
VALUES ('telegram', 'bot_token_here', 'my_bot');
```

### 8. CONTACT STORAGE

#### WhatsApp
```sql
-- Stored in contacts table
INSERT INTO contacts (channel_id, external_id, display_name)
VALUES (channel_id, '919876543210', 'John Doe');
```

#### Telegram
```sql
-- Stored in contacts table
INSERT INTO contacts (channel_id, external_id, display_name, profile)
VALUES (channel_id, '987654321', 'John Doe', 
  '{"telegram_user_id": 987654321, "username": "john_doe"}');
```

### 9. API ENDPOINTS

#### WhatsApp
```
POST /api/auth/whatsapp/onboard
  - Handles OAuth callback
  - Fetches WABA IDs
  - Fetches phone numbers
  - Saves to whatsapp_settings

GET /api/templates
  - Fetches templates from Meta API
  - Filters by phone number
  - Merges with local templates
```

#### Telegram
```
POST /api/auth/telegram/connect
  - Accepts bot token
  - Verifies with Telegram API
  - Sets up webhook
  - Saves to telegram_settings

GET /api/auth/telegram/settings
  - Lists all connected bots
  - Shows bot info

DELETE /api/auth/telegram/disconnect/:botToken
  - Disconnects bot
  - Deletes webhook
```

### 10. WEBHOOK ENDPOINTS

#### WhatsApp
```
GET /webhooks/whatsapp
  - Verification endpoint
  - Echoes hub.challenge

POST /webhooks/whatsapp
  - Receives messages
  - Verifies signature
  - Processes messages
```

#### Telegram
```
GET /webhooks/telegram
  - Health check

POST /webhooks/telegram
  - Receives updates
  - Verifies secret token
  - Processes messages
```

### 11. RATE LIMITING

#### WhatsApp
```javascript
// Per-app/token rate limiting
// Meta enforces limits
// Implemented in whatsappClient.js
const LAG_MS = 100; // Space requests 100ms apart
```

#### Telegram
```javascript
// Per-bot rate limiting
// Telegram enforces limits
// Implemented in telegramClient.js
const LAG_MS = 100; // Space requests 100ms apart
```

### 12. REALTIME EVENTS

#### Both Use Same Socket.io Events
```javascript
// Message received
socket.on('message:new', (payload) => {
  // Same format for both WhatsApp and Telegram
});

// Message status
socket.on('message:status', (payload) => {
  // Same format for both
});

// Typing indicator
socket.on('conversation:typing', (payload) => {
  // Same format for both
});
```

### 13. DATABASE SCHEMA

#### Shared Tables (Both Use)
```sql
-- Same tables for both WhatsApp and Telegram
- conversations
- messages
- contacts
- channels
- attachments
- conversation_assignments
- messages (with channel_id, external_message_id for idempotency)
```

#### Unique Tables
```sql
-- WhatsApp only
- whatsapp_settings

-- Telegram only
- telegram_settings
```

### 14. INTEGRATIONS

#### Both Support
- ✅ Language detection and translation
- ✅ AI agent auto-replies
- ✅ Workflow triggers
- ✅ Message rules evaluation
- ✅ Contact blocking
- ✅ Message history
- ✅ Media attachments
- ✅ Realtime updates

### 15. MULTIPLE CHANNELS

#### WhatsApp
```
Multiple phone numbers per team
- Each phone number = separate channel
- Each has own WABA ID and token
- Stored in whatsapp_settings
- Filtered by phone_number_id
```

#### Telegram
```
Multiple bots per team
- Each bot = separate channel
- Each has own bot token
- Stored in telegram_settings
- Filtered by bot_token
```

### 16. FRONTEND DISPLAY

#### Both Show in Same Inbox
```javascript
// Inbox shows both WhatsApp and Telegram chats
conversations.map(c => {
  const channelType = c.channel_type; // 'whatsapp' or 'telegram'
  const channelName = c.channel_name; // Phone number or bot name
  // Display in same list
});
```

### 17. MESSAGE SENDING

#### WhatsApp
```javascript
// Route to correct service based on channel type
if (channel.type === 'whatsapp') {
  await outboundWhatsApp.sendText(conversationId, text);
}
```

#### Telegram
```javascript
// Route to correct service based on channel type
if (channel.type === 'telegram') {
  await outboundTelegram.sendText(conversationId, text);
}
```

### 18. IDEMPOTENCY

#### Both Use Same Approach
```sql
-- Unique constraint on (channel_id, external_message_id)
UNIQUE (channel_id, external_message_id)

-- ON CONFLICT DO NOTHING prevents duplicates
INSERT INTO messages (...)
ON CONFLICT (channel_id, external_message_id)
DO NOTHING
```

### 19. ERROR HANDLING

#### WhatsApp
```javascript
// API errors from Meta
- 400: Invalid request
- 401: Invalid token
- 403: Insufficient permissions
- 429: Rate limited
- 500: Server error
```

#### Telegram
```javascript
// API errors from Telegram
- 400: Invalid request
- 401: Unauthorized
- 403: Forbidden
- 429: Rate limited
- 500: Server error
```

### 20. CONFIGURATION

#### WhatsApp Environment Variables
```bash
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...
META_APP_SECRET=...
```

#### Telegram Environment Variables
```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=...
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_USE_MOCK=...
TELEGRAM_RATE_LIMIT_MS=...
```

## Key Similarities

1. ✅ Same database schema
2. ✅ Same message flow
3. ✅ Same realtime events
4. ✅ Same integrations
5. ✅ Same frontend display
6. ✅ Same idempotency approach
7. ✅ Same error handling
8. ✅ Same multi-channel support

## Key Differences

1. ❌ Different authentication (OAuth vs bot token)
2. ❌ Different webhook verification (HMAC vs secret token)
3. ❌ Different message types (templates in WhatsApp only)
4. ❌ Different APIs (Meta Cloud API vs Telegram Bot API)
5. ❌ Different rate limiting (per app vs per bot)
6. ❌ Different configuration storage (separate tables)
7. ❌ No 24-hour window in Telegram
8. ❌ No templates in Telegram

## Summary

The Telegram integration mirrors WhatsApp architecture perfectly:
- Same database tables
- Same message flow
- Same realtime events
- Same integrations
- Same frontend display

The only differences are:
- Authentication method
- Webhook verification
- API endpoints
- Message types supported
- Configuration storage

This makes it easy to maintain and extend both integrations.
