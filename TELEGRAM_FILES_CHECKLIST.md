# Telegram Integration Files - Complete Checklist

## All Files You Need for Commit 61f33d4

### ✅ Files Already Created (Ready to Use)

These files are already created and ready to copy into your project:

1. **Database Migration**
   - File: `backend/db/migrations/0024_telegram_support.sql`
   - Status: ✅ Created
   - Purpose: Add telegram_settings table and enum

2. **Telegram Client**
   - File: `backend/src/integrations/telegram/telegramClient.js`
   - Status: ✅ Created
   - Purpose: Telegram Bot API client

3. **Telegram Webhook**
   - File: `backend/src/webhooks/telegram.js`
   - Status: ✅ Created
   - Purpose: Receive and process incoming messages

4. **Telegram Auth Route**
   - File: `backend/src/routes/telegramAuth.js`
   - Status: ✅ Created
   - Purpose: Connect/disconnect bots

5. **Telegram Outbound Service**
   - File: `backend/src/services/outboundTelegram.js`
   - Status: ✅ Created
   - Purpose: Send messages to Telegram

6. **Telegram Config Utility**
   - File: `backend/src/utils/telegramConfig.js`
   - Status: ✅ Created (in guide)
   - Purpose: Fetch Telegram settings from database

### 📝 Files to Create (Copy from Guide)

From `TELEGRAM_INTEGRATION_FOR_61f33d4.md`, copy the code for:

1. **Telegram Config Utility**
   ```
   backend/src/utils/telegramConfig.js
   ```
   - Copy from Step 2 in the guide

### 🔧 Files to Modify

1. **Backend App**
   ```
   backend/app.js
   ```
   - Add imports for Telegram routes
   - Add webhook and auth routes

2. **Frontend API**
   ```
   frontend/src/api.js
   ```
   - Add getTelegramSettings()
   - Add connectTelegram()
   - Add disconnectTelegram()

3. **Settings Page**
   ```
   frontend/src/components/SettingsPage.jsx
   ```
   - Add Telegram section
   - Add bot token input
   - Add connect/disconnect buttons

## Step-by-Step Implementation

### Step 1: Create New Files

Copy these files into your project:

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
│   ├── services/
│   │   └── outboundTelegram.js
│   └── utils/
│       └── telegramConfig.js
```

### Step 2: Modify Existing Files

#### backend/app.js

Add at top with other imports:
```javascript
const telegramWebhookRouter = require('./src/webhooks/telegram');
const telegramAuthRouter = require('./src/routes/telegramAuth');
```

Add in webhook section:
```javascript
app.use('/webhooks/telegram', telegramWebhookRouter);
```

Add in auth section:
```javascript
app.use('/api/auth/telegram', telegramAuthRouter);
```

#### frontend/src/api.js

Add these functions:
```javascript
export async function getTelegramSettings(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/auth/telegram/settings?${params.toString()}`, { headers });
  return res.json();
}

export async function connectTelegram(botToken, displayName, teamId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/auth/telegram/connect', {
    method: 'POST',
    headers,
    body: JSON.stringify({ botToken, displayName, teamId })
  });
  return res.json();
}

export async function disconnectTelegram(botToken, teamId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/auth/telegram/disconnect/${botToken}?teamId=${teamId}`, {
    method: 'DELETE',
    headers
  });
  return res.json();
}
```

#### frontend/src/components/SettingsPage.jsx

Add imports:
```javascript
import { getTelegramSettings, connectTelegram, disconnectTelegram } from '../api';
```

Add state:
```javascript
const [telegramSettings, setTelegramSettings] = useState([]);
const [loadingTelegram, setLoadingTelegram] = useState(false);
const [savingTelegram, setSavingTelegram] = useState(false);
const [telegramError, setTelegramError] = useState(null);
const [botTokenInput, setBotTokenInput] = useState('');
const [botDisplayName, setBotDisplayName] = useState('');
```

Add useEffect to load settings:
```javascript
useEffect(() => {
  if (!teamId) return;
  const load = async () => {
    try {
      setLoadingTelegram(true);
      const res = await getTelegramSettings(teamId);
      if (res && res.settings) {
        setTelegramSettings(res.settings);
      }
    } catch (err) {
      console.error('Failed to load Telegram settings:', err);
    } finally {
      setLoadingTelegram(false);
    }
  };
  load();
}, [teamId]);
```

Add handlers:
```javascript
const handleConnectTelegram = async () => {
  if (!botTokenInput) {
    setTelegramError('Bot token is required');
    return;
  }
  try {
    setSavingTelegram(true);
    setTelegramError(null);
    const res = await connectTelegram(botTokenInput, botDisplayName || 'Telegram Bot', teamId);
    if (res.success) {
      setBotTokenInput('');
      setBotDisplayName('');
      const updated = await getTelegramSettings(teamId);
      if (updated && updated.settings) {
        setTelegramSettings(updated.settings);
      }
      alert('Telegram bot connected successfully!');
    } else {
      setTelegramError(res.error || 'Failed to connect bot');
    }
  } catch (err) {
    setTelegramError('Failed to connect Telegram bot');
  } finally {
    setSavingTelegram(false);
  }
};

const handleDisconnectTelegram = async (botToken) => {
  if (!window.confirm('Are you sure?')) return;
  try {
    setSavingTelegram(true);
    const res = await disconnectTelegram(botToken, teamId);
    if (res.success) {
      const updated = await getTelegramSettings(teamId);
      if (updated && updated.settings) {
        setTelegramSettings(updated.settings);
      }
      alert('Telegram bot disconnected successfully!');
    }
  } catch (err) {
    setTelegramError('Failed to disconnect Telegram bot');
  } finally {
    setSavingTelegram(false);
  }
};
```

Add JSX (see full guide for complete component)

### Step 3: Configure Environment

Add to `.env`:
```bash
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhooks/telegram
TELEGRAM_WEBHOOK_SECRET=your_secret_here
TELEGRAM_USE_MOCK=false
TELEGRAM_RATE_LIMIT_MS=100
```

### Step 4: Run Migration

```bash
cd backend
npm run migrate
```

### Step 5: Test

1. Create Telegram bot via @BotFather
2. Add bot token to `.env`
3. Restart backend
4. Go to Settings → Telegram
5. Paste bot token and connect
6. Send message to bot on Telegram
7. Check inbox - message should appear

## File Locations

```
backend/
├── app.js (MODIFY)
├── db/
│   └── migrations/
│       └── 0024_telegram_support.sql (CREATE)
└── src/
    ├── integrations/
    │   └── telegram/
    │       └── telegramClient.js (CREATE)
    ├── routes/
    │   └── telegramAuth.js (CREATE)
    ├── services/
    │   └── outboundTelegram.js (CREATE)
    ├── utils/
    │   └── telegramConfig.js (CREATE)
    └── webhooks/
        └── telegram.js (CREATE)

frontend/
└── src/
    ├── api.js (MODIFY)
    └── components/
        └── SettingsPage.jsx (MODIFY)
```

## Summary

**Files to Create**: 6
- 1 migration
- 1 client
- 1 webhook
- 1 auth route
- 1 outbound service
- 1 config utility

**Files to Modify**: 3
- backend/app.js
- frontend/src/api.js
- frontend/src/components/SettingsPage.jsx

**Total Changes**: 9 files

## Documentation

- **Full Implementation Guide**: `TELEGRAM_INTEGRATION_FOR_61f33d4.md`
- **Quick Summary**: `TELEGRAM_FOR_61f33d4_SUMMARY.md`
- **This Checklist**: `TELEGRAM_FILES_CHECKLIST.md`
- **Quick Start**: `TELEGRAM_QUICK_START.md`
- **Comparison**: `WHATSAPP_VS_TELEGRAM_COMPARISON.md`

## Ready to Go!

All files are created and ready to use. Follow the checklist above to integrate Telegram into your commit 61f33d4 codebase.
