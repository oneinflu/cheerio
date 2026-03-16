# Chat Filtering by Phone Number - Debugging & Fix Guide

## Problem Summary

Incoming chats are not filtering properly by phone number in the chats page, even though:
- ✅ Templates are working correctly with multiple phone numbers
- ✅ Settings page shows all connected numbers
- ✅ Webhook is receiving messages correctly
- ❌ Chat page shows all chats regardless of selected phone number

## Root Cause Analysis

### How Templates Work (Reference Implementation)

**Templates Route** (`backend/src/routes/templates.js`):
```javascript
// Gets ALL configured phone numbers for the team
const configs = await waConfig.getAllConfigs(teamId);

// Iterates through each WABA and fetches templates
for (const config of configs) {
  const resp = await whatsappClient.getTemplates(wabaId, 100, config);
  allMetaTemplates.push(...metaTemplates.map(t => ({
    ...t,
    wabaId,
    phoneNumberId: config.phoneNumberId  // Tags with phone number
  })));
}
```

**Frontend** (`frontend/src/components/TemplatesPage.jsx`):
- Fetches all linked phones from `/api/settings/whatsapp`
- Stores in `linkedPhones` state
- Allows filtering by `selectedPhoneNumberId`
- Passes to API: `getTemplates(phoneNumberId)`

### How Chats Should Work (Current Implementation)

**Inbox Route** (`backend/src/routes/inbox.js`):
```javascript
const phoneNumberId = req.query.phoneNumberId || null;
const list = await svc.listConversations(teamId, userId, userRole, filter, phoneNumberId);
```

**Inbox Service** (`backend/src/services/inbox.js`):
```javascript
// Phone Number Filter
if (phoneNumberId) {
  params.push(phoneNumberId);
  whereClause += ` AND ch.external_id = $${params.length} `;
}

// Query joins channels and filters by external_id
FROM conversations c
JOIN channels ch ON ch.id = c.channel_id
WHERE ch.external_id = $phoneNumberId
```

**Frontend** (`frontend/src/App.jsx`):
- Fetches linked phones from `/api/settings/whatsapp`
- Stores in `linkedPhones` state
- Allows filtering by `phoneNumberId`
- Passes to API: `getInbox(teamId, filter, phoneNumberId)`

## Data Flow Verification

### 1. Incoming Message Storage (Webhook)

**File**: `backend/src/webhooks/whatsapp.js`

```javascript
// Extract phone number from Meta webhook
const phoneNumberId = metadata.phone_number_id;

// Upsert channel with phone number as external_id
const channelResult = await client.query(`
  INSERT INTO channels (id, type, name, external_id, config, active)
  VALUES (gen_random_uuid(), 'whatsapp', $1, $2, '{}'::jsonb, TRUE)
  ON CONFLICT (type, external_id)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`, [metadata.display_phone_number || 'WhatsApp Number', phoneNumberId]);
```

**Key Point**: The `phoneNumberId` from Meta webhook is stored as `channels.external_id`

### 2. Settings Storage

**File**: `backend/src/routes/whatsappAuth.js`

```javascript
// When user connects a phone number
await db.query(`
  INSERT INTO whatsapp_settings (team_id, phone_number_id, business_account_id, permanent_token, display_phone_number, is_active)
  VALUES ($1, $2, $3, $4, $5, true)
`, [teamId, phoneNumberId, businessAccountId, accessToken, displayPhoneNumber]);
```

**Key Point**: Phone numbers are stored in `whatsapp_settings.phone_number_id`

### 3. Inbox Query

**File**: `backend/src/services/inbox.js`

```javascript
// The query filters by channel.external_id
WHERE ch.external_id = $phoneNumberId
```

**Key Point**: This should match the phone number ID from the webhook

## Debugging Steps

### Step 1: Run the Debug Script

```bash
cd backend
node scripts/debug_chats_by_number.js
```

This will show:
- All channels and their phone numbers
- All WhatsApp settings
- Conversations grouped by phone number
- Environment variables

### Step 2: Check Database Directly

```sql
-- Check all channels
SELECT id, type, external_id, name FROM channels WHERE type = 'whatsapp';

-- Check all settings
SELECT team_id, phone_number_id, display_phone_number, is_active FROM whatsapp_settings;

-- Check conversations per phone
SELECT ch.external_id, COUNT(c.id) as conv_count
FROM conversations c
JOIN channels ch ON ch.id = c.channel_id
GROUP BY ch.external_id;

-- Test the filter query
SELECT COUNT(*) FROM conversations c
JOIN channels ch ON ch.id = c.channel_id
WHERE ch.external_id = '921055841100882';  -- Replace with your phone number
```

### Step 3: Check Frontend Network Requests

1. Open DevTools → Network tab
2. Select a phone number from the dropdown
3. Look for the `/api/inbox?...` request
4. Verify the `phoneNumberId` parameter is being sent correctly

Example URL:
```
/api/inbox?teamId=xxx&filter=open&phoneNumberId=921055841100882
```

### Step 4: Check Backend Logs

Look for these log messages:
```
[InboxRoute] GET /inbox teamId=xxx filter=open phoneNumberId=921055841100882
[InboxService] listConversations filter='open', userId=xxx, phone='921055841100882'
[InboxService] Filtering by phone number: 921055841100882
```

## Common Issues & Solutions

### Issue 1: Phone Number ID Mismatch

**Symptom**: Dropdown shows phone numbers, but no chats appear when selected

**Cause**: The phone number ID in `channels.external_id` doesn't match what's in `whatsapp_settings.phone_number_id`

**Solution**:
```sql
-- Check for mismatches
SELECT DISTINCT ch.external_id FROM channels ch
WHERE ch.external_id NOT IN (SELECT phone_number_id FROM whatsapp_settings);

-- If found, either:
-- 1. Update channels to match settings
UPDATE channels SET external_id = '921055841100882' WHERE external_id = '91-205-584-1100882';

-- 2. Or add missing settings
INSERT INTO whatsapp_settings (team_id, phone_number_id, business_account_id, permanent_token, display_phone_number, is_active)
VALUES ('team-id', '921055841100882', 'waba-id', 'token', '+91 205 584 1100882', true);
```

### Issue 2: Dropdown Not Showing Multiple Phones

**Symptom**: Dropdown only shows "All Channels", no individual phones

**Cause**: `linkedPhones` array is empty or has only one phone

**Solution**:
```javascript
// In App.jsx, add debug logging
useEffect(() => {
  if (!storedUser) return;
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/whatsapp');
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched settings:', data);  // Add this
        setLinkedPhones(data.allSettings || []);
      }
    } catch (e) {
      console.error("Failed to fetch linked phones", e);
    }
  };
  fetchSettings();
}, [storedUser]);
```

### Issue 3: Chats Not Updating When Phone Selected

**Symptom**: Selecting a phone number doesn't refresh the chat list

**Cause**: `phoneNumberId` is not in the `useEffect` dependency array

**Solution**: Already fixed in `App.jsx`:
```javascript
useEffect(() => {
  loadInbox();
}, [currentUser, inboxFilter, phoneNumberId]);  // phoneNumberId is here
```

### Issue 4: Environment Variables Interfering

**Symptom**: Only seeing chats from the default phone number in `.env`

**Cause**: Fallback logic in `whatsappConfig.js` is using `.env` values instead of database settings

**Solution**: Ensure `whatsappConfig.getAllConfigs(teamId)` is being called:
```javascript
// In templates.js
let configs = [];
if (phoneNumberId) {
  const config = await waConfig.getConfigByPhone(phoneNumberId);
  if (config.isCustom || config.phoneNumberId) configs = [config];
} else {
  configs = await waConfig.getAllConfigs(teamId);  // Gets all from DB
}

// Fallback only if no custom configs
if (configs.length === 0) {
  configs = [{
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || WABA_ID,
    token: process.env.WHATSAPP_TOKEN,
    isCustom: false
  }];
}
```

## Implementation Checklist

- [ ] Run debug script: `node scripts/debug_chats_by_number.js`
- [ ] Verify phone numbers match between `channels.external_id` and `whatsapp_settings.phone_number_id`
- [ ] Check frontend network requests include `phoneNumberId` parameter
- [ ] Verify backend logs show filtering is applied
- [ ] Test selecting each phone number from dropdown
- [ ] Verify chats update correctly for each phone
- [ ] Test with "All Channels" option
- [ ] Verify outgoing messages use correct phone number

## Testing Checklist

### Test 1: Multiple Phone Numbers
1. Connect 2+ phone numbers in Settings
2. Verify dropdown shows all phones
3. Select each phone and verify chats appear
4. Select "All Channels" and verify all chats appear

### Test 2: Incoming Messages
1. Send message to Phone #1
2. Verify it appears when Phone #1 is selected
3. Verify it does NOT appear when Phone #2 is selected
4. Verify it appears when "All Channels" is selected

### Test 3: Outgoing Messages
1. Select Phone #1
2. Send a message
3. Verify it's sent from Phone #1
4. Verify the response comes to Phone #1

### Test 4: Templates
1. Create template for Phone #1
2. Send template message
3. Verify it uses Phone #1's token and WABA

## Files Modified

- `backend/src/services/inbox.js` - Added logging for phone number filtering
- `backend/scripts/debug_chats_by_number.js` - New debug script

## Next Steps

1. Run the debug script to identify the exact issue
2. Check database for phone number mismatches
3. Verify frontend is sending the correct parameter
4. Check backend logs for filtering logic
5. Test with each phone number individually
