# Telegram Integration Guide

## Overview

Telegram support has been added to your application, mirroring the WhatsApp architecture. Users can now receive and manage Telegram chats alongside WhatsApp conversations.

## Architecture

### How It Works

```
Telegram User
  ↓
Telegram Bot API
  ↓
Webhook: POST /webhooks/telegram
  ↓
Backend Processing
  ├─ Upsert channel (type='telegram', external_id=bot_token)
  ├─ Upsert contact (external_id=user_id)
  ├─ Find/create conversation
  ├─ Insert message with idempotency
  ├─ Handle media attachments
  └─ Emit realtime events
  ↓
Database Storage
  ├─ conversations table
  ├─ messages table
  ├─ contacts table
  ├─ channels table
  └─ telegram_settings table
  ↓
Frontend Display
  ├─ Inbox shows Telegram chats
  ├─ Chat component displays messages
  ├─ Send text/media messages
  └─ Realtime updates via Socket.io
```

## Setup Instructions

### Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow the prompts to create a new bot
4. You'll receive a bot token: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`
5. Save this token securely

### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhooks/telegram
TELEGRAM_WEBHOOK_SECRET=your-secret-token-here
TELEGRAM_USE_MOCK=false
TELEGRAM_RATE_LIMIT_MS=100
```

### Step 3: Connect Telegram Bot in Settings

1. Go to Settings → Telegram
2. Paste your bot token
3. Click "Connect"
4. The system will verify the token and set up the webhook

### Step 4: Test the Connection

1. Find your bot on Telegram (search by username)
2. Send a message to the bot
3. Check if the message appears in your inbox

## API Endpoints

### Connect Telegram Bot
```
POST /api/auth/telegram/connect
Content-Type: application/json

{
  "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  "displayName": "My Telegram Bot"
}

Response:
{
  "success": true,
  "data": {
    "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    "botUsername": "my_bot",
    "displayName": "My Telegram Bot",
    "botInfo": {
      "id": 123456789,
      "firstName": "My Bot",
      "username": "my_bot",
      "isBot": true
    }
  }
}
```

### Get Telegram Settings
```
GET /api/auth/telegram/settings

Response:
{
  "teamId": "team-1",
  "settings": [
    {
      "id": "uuid",
      "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
      "bot_username": "my_bot",
      "display_name": "My Telegram Bot",
      "is_active": true,
      "created_at": "2024-03-16T10:00:00Z",
      "updated_at": "2024-03-16T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Disconnect Telegram Bot
```
DELETE /api/auth/telegram/disconnect/123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

Response:
{
  "success": true,
  "message": "Telegram bot @my_bot disconnected"
}
```

## Database Schema

### telegram_settings Table
```sql
CREATE TABLE telegram_settings (
    id UUID PRIMARY KEY,
    team_id TEXT NOT NULL,
    bot_token TEXT NOT NULL,
    bot_username TEXT,
    display_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(team_id, bot_token)
);
```

### Channels Table (Updated)
```sql
-- channel_type enum now includes 'telegram'
-- Telegram channels stored with:
-- - type = 'telegram'
-- - external_id = bot_token
-- - name = bot username
```

### Contacts Table (Updated)
```sql
-- Telegram contacts stored with:
-- - channel_id = telegram channel
-- - external_id = telegram user_id
-- - profile.telegram_user_id = user_id
-- - profile.username = telegram username
```

## Features

### Supported Message Types

**Inbound:**
- ✅ Text messages
- ✅ Photos
- ✅ Documents
- ✅ Audio files
- ✅ Videos
- ✅ Voice messages
- ✅ Stickers
- ✅ Locations
- ✅ Contacts

**Outbound:**
- ✅ Text messages
- ✅ Photos
- ✅ Documents
- ✅ Audio files
- ✅ Videos
- ✅ Typing indicators

### Features

- ✅ Multiple Telegram bots per team
- ✅ Automatic conversation creation
- ✅ Message history
- ✅ Media attachments
- ✅ Language detection and translation
- ✅ AI agent integration
- ✅ Workflow triggers
- ✅ Message rules evaluation
- ✅ Realtime updates via Socket.io
- ✅ Idempotent message processing
- ✅ Contact blocking

## File Structure

### New Files Created

```
backend/
├── db/migrations/
│   └── 0024_telegram_support.sql
├── src/
│   ├── integrations/telegram/
│   │   └── telegramClient.js
│   ├── webhooks/
│   │   └── telegram.js
│   ├── routes/
│   │   └── telegramAuth.js
│   └── services/
│       └── outboundTelegram.js
```

### Modified Files

```
backend/
├── app.js (added Telegram routes and webhooks)
```

## Sending Messages

### Send Text Message

```javascript
const outboundTelegram = require('../services/outboundTelegram');

await outboundTelegram.sendText(conversationId, 'Hello from Telegram!');
```

### Send Media Message

```javascript
await outboundTelegram.sendMedia(
  conversationId,
  'image',
  'https://example.com/image.jpg',
  'Image caption'
);
```

### Send Typing Indicator

```javascript
await outboundTelegram.sendTypingIndicator(conversationId, true);
```

## Frontend Integration

### Display Telegram Chats

The inbox automatically shows Telegram chats alongside WhatsApp chats. The channel type is displayed in the UI.

### Send Messages

The chat component automatically detects the channel type and sends messages via the appropriate service.

### Filter by Channel

Users can filter conversations by channel type (WhatsApp, Telegram, Instagram).

## Webhook Configuration

### Webhook URL

```
https://yourdomain.com/webhooks/telegram
```

### Webhook Secret

Set in environment variable `TELEGRAM_WEBHOOK_SECRET`

### Webhook Verification

The webhook verifies the `X-Telegram-Bot-Api-Secret-Token` header.

## Realtime Events

### Message Received
```javascript
socket.on('message:new', (payload) => {
  // payload.conversationId
  // payload.messageId
  // payload.contentType
  // payload.textBody
  // payload.direction = 'inbound'
  // payload.attachments
});
```

### Message Status Updated
```javascript
socket.on('message:status', (payload) => {
  // payload.conversationId
  // payload.messageId
  // payload.status = 'sent' | 'delivered' | 'failed'
});
```

## Error Handling

### Invalid Bot Token
```
Error: Invalid bot token
Details: Failed to verify bot
```
**Fix**: Verify the bot token is correct and the bot exists

### Webhook Setup Failed
```
Warning: Failed to set webhook
```
**Fix**: Ensure `TELEGRAM_WEBHOOK_URL` is set and accessible

### Message Send Failed
```
Error: Telegram API error: Chat not found
```
**Fix**: Verify the chat ID is valid

## Troubleshooting

### Messages Not Appearing

1. Check if bot is connected in Settings
2. Verify bot token is correct
3. Check server logs for webhook errors
4. Ensure webhook URL is accessible

### Webhook Not Receiving Messages

1. Verify webhook URL is correct
2. Check firewall/network settings
3. Verify secret token matches
4. Check Telegram bot webhook status

### Messages Not Sending

1. Verify conversation exists
2. Check bot token is valid
3. Verify chat ID is correct
4. Check server logs for errors

## Testing

### Test with Mock Mode

Set in `.env`:
```bash
TELEGRAM_USE_MOCK=true
```

This will simulate Telegram API responses without making real API calls.

### Test Webhook

```bash
curl -X POST https://yourdomain.com/webhooks/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: your-secret" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "date": 1234567890,
      "chat": {
        "id": 987654321,
        "type": "private"
      },
      "from": {
        "id": 987654321,
        "is_bot": false,
        "first_name": "John",
        "username": "john_doe"
      },
      "text": "Hello!"
    }
  }'
```

## Comparison with WhatsApp

| Feature | WhatsApp | Telegram |
|---------|----------|----------|
| **Setup** | Meta Business Suite | BotFather |
| **Authentication** | OAuth token | Bot token |
| **Webhook** | Signature verification | Secret token |
| **Message Types** | Text, media, templates | Text, media, interactive |
| **24-hour window** | Yes | No |
| **Templates** | Yes | No |
| **Flows** | Yes | No |
| **Multiple numbers** | Yes | Yes (multiple bots) |
| **Rate limiting** | Per app/token | Per bot |

## Next Steps

1. Create a Telegram bot via BotFather
2. Add bot token to `.env`
3. Set webhook URL in `.env`
4. Run database migration: `node backend/scripts/migrate.js`
5. Connect bot in Settings → Telegram
6. Test by sending a message to the bot
7. Verify message appears in inbox

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs
3. Verify environment variables
4. Test webhook with curl
5. Check Telegram bot status with BotFather

## References

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Guide](https://core.telegram.org/bots#botfather)
- [Webhook Setup](https://core.telegram.org/bots/webhooks)
