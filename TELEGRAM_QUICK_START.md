# Telegram Integration - Quick Start

## 5-Minute Setup

### Step 1: Create Telegram Bot (2 minutes)

1. Open Telegram
2. Search for `@BotFather`
3. Send `/newbot`
4. Follow prompts:
   - Name: "My Bot"
   - Username: "my_awesome_bot"
5. Copy the token: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

### Step 2: Configure Environment (1 minute)

Add to `.env`:
```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhooks/telegram
TELEGRAM_WEBHOOK_SECRET=your-secret-token-here
```

### Step 3: Run Migration (1 minute)

```bash
cd backend
npm run migrate
# or
node scripts/migrate.js
```

### Step 4: Connect Bot (1 minute)

1. Go to Settings → Telegram
2. Paste bot token
3. Click "Connect"
4. Done!

## Test It

1. Find your bot on Telegram
2. Send a message
3. Check inbox - message should appear!

## What's Included

✅ Telegram webhook handler
✅ Message storage
✅ Media support
✅ Realtime updates
✅ Outbound messaging
✅ Multiple bots per team
✅ Language detection
✅ AI agent integration

## Key Differences from WhatsApp

| WhatsApp | Telegram |
|----------|----------|
| Phone numbers | Bot tokens |
| Meta API | Telegram Bot API |
| Templates | No templates |
| 24-hour window | No window |
| Multiple numbers | Multiple bots |

## Common Issues

### "Invalid bot token"
- Copy token from BotFather exactly
- Don't include extra spaces

### "Webhook not working"
- Verify `TELEGRAM_WEBHOOK_URL` is correct
- Ensure domain is accessible
- Check firewall settings

### "Messages not appearing"
- Verify bot is connected in Settings
- Send message to bot on Telegram
- Check server logs

## Next Steps

1. ✅ Create bot
2. ✅ Add to .env
3. ✅ Run migration
4. ✅ Connect in Settings
5. ✅ Test with message
6. 📖 Read full guide: TELEGRAM_INTEGRATION_GUIDE.md

## File Changes

**New Files:**
- `backend/db/migrations/0024_telegram_support.sql`
- `backend/src/integrations/telegram/telegramClient.js`
- `backend/src/webhooks/telegram.js`
- `backend/src/routes/telegramAuth.js`
- `backend/src/services/outboundTelegram.js`

**Modified Files:**
- `backend/app.js` (added routes)

## API Endpoints

```bash
# Connect bot
POST /api/auth/telegram/connect
{
  "botToken": "...",
  "displayName": "My Bot"
}

# Get settings
GET /api/auth/telegram/settings

# Disconnect bot
DELETE /api/auth/telegram/disconnect/{botToken}
```

## Database

New table: `telegram_settings`
- Stores bot tokens per team
- Tracks bot username and display name
- Supports multiple bots per team

## Features

- ✅ Text messages
- ✅ Photos, documents, audio, video
- ✅ Typing indicators
- ✅ Message history
- ✅ Realtime updates
- ✅ Language detection
- ✅ AI responses
- ✅ Workflow triggers
- ✅ Message rules

## Support

See `TELEGRAM_INTEGRATION_GUIDE.md` for detailed documentation.
