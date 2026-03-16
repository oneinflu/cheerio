# Quick Test Guide - Chat Filtering by Phone Number

## Quick Diagnosis

### 1. Check if Multiple Phones are Connected

**Frontend Check:**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for this log when page loads:
   ```
   [Settings] Fetched WhatsApp settings: [
     { phone: '921055841100882', display: '+91 205 584 1100882' },
     { phone: '919876543210', display: '+91 987 654 3210' }
   ]
   ```
4. If you see only 1 phone or empty array, the issue is in settings

### 2. Check if Dropdown Shows Multiple Phones

**Visual Check:**
1. Look at the chat page
2. Above the chat list, there should be a dropdown that says "All Channels"
3. If dropdown is missing → only 1 phone connected
4. If dropdown shows multiple phones → proceed to step 3

### 3. Check if Filtering Works

**Frontend Check:**
1. Open DevTools Console
2. Select a phone number from dropdown
3. Look for this log:
   ```
   [Inbox] Loading with filter=open, phoneNumberId=921055841100882
   [Inbox] Loaded 5 conversations
   ```
4. If `phoneNumberId` is empty or null → filtering not working
5. If `phoneNumberId` is set but conversations count doesn't change → backend issue

### 4. Check Backend Filtering

**Backend Check:**
1. Look at server logs
2. When you select a phone, you should see:
   ```
   [InboxRoute] GET /inbox teamId=xxx filter=open phoneNumberId=921055841100882
   [InboxService] listConversations filter='open', userId=xxx, phone='921055841100882'
   [InboxService] Filtering by phone number: 921055841100882
   ```
3. If these logs don't appear → request not reaching backend
4. If logs appear but conversations still wrong → database issue

## Step-by-Step Test

### Test Setup
- Have 2+ phone numbers connected
- Have received messages on each phone number

### Test Procedure

**Step 1: Select Phone #1**
```
Expected: See only chats from Phone #1
Actual: [Check what you see]
```

**Step 2: Select Phone #2**
```
Expected: See only chats from Phone #2
Actual: [Check what you see]
```

**Step 3: Select "All Channels"**
```
Expected: See chats from all phones
Actual: [Check what you see]
```

**Step 4: Send Test Message**
1. Select Phone #1
2. Send a test message to a contact
3. Verify message appears in Phone #1 chats
4. Select Phone #2
5. Verify message does NOT appear in Phone #2 chats

## Common Scenarios & Solutions

### Scenario 1: Dropdown Not Showing
**Problem**: Only see "All Channels", no individual phones
**Check**:
```javascript
// In DevTools Console
// Should show multiple phones
console.log(linkedPhones)
```
**Solution**: 
- Go to Settings → WhatsApp
- Connect additional phone numbers
- Refresh page

### Scenario 2: Dropdown Shows Phones But Filtering Doesn't Work
**Problem**: Selecting a phone doesn't change the chat list
**Check**:
```javascript
// In DevTools Console, select a phone and check
console.log(phoneNumberId)  // Should show the selected phone ID
```
**Solution**:
- Check backend logs for filtering
- Run debug script: `node scripts/debug_chats_by_number.js`
- Check database for phone number mismatches

### Scenario 3: All Chats Show Regardless of Selection
**Problem**: Filtering parameter is being sent but ignored
**Check**:
```
Backend logs should show:
[InboxService] Filtering by phone number: 921055841100882
```
**Solution**:
- Check if phone number ID matches between settings and channels
- Run: `node scripts/debug_chats_by_number.js`
- Check database query directly

### Scenario 4: Only Default Phone Works
**Problem**: Only chats from the phone number in `.env` appear
**Check**:
```sql
SELECT * FROM whatsapp_settings;
```
**Solution**:
- Ensure new phones are being saved to `whatsapp_settings` table
- Check if `getAllConfigs()` is being called correctly
- Verify `.env` fallback isn't overriding database settings

## Debug Commands

### Run Full Debug
```bash
cd backend
node scripts/debug_chats_by_number.js
```

### Check Database Directly
```bash
# Connect to database
psql postgresql://user:pass@localhost:5432/dbname

# Check all phones
SELECT phone_number_id, display_phone_number FROM whatsapp_settings;

# Check conversations per phone
SELECT ch.external_id, COUNT(c.id) FROM conversations c 
JOIN channels ch ON ch.id = c.channel_id 
GROUP BY ch.external_id;

# Test filter query
SELECT COUNT(*) FROM conversations c 
JOIN channels ch ON ch.id = c.channel_id 
WHERE ch.external_id = '921055841100882';
```

### Check Frontend Network
1. Open DevTools → Network tab
2. Filter by "inbox"
3. Select a phone number
4. Look for `/api/inbox?...` request
5. Check URL parameters:
   - `phoneNumberId=921055841100882` ✓ (should be present)
   - `phoneNumberId=` ✗ (empty = not working)

### Check Frontend Console
```javascript
// Paste in DevTools Console to see current state
console.log({
  phoneNumberId: phoneNumberId,
  linkedPhones: linkedPhones,
  conversationCount: conversations?.length
})
```

## Expected Behavior

### When Everything Works
1. ✅ Dropdown shows all connected phones
2. ✅ Selecting a phone filters chats to that phone only
3. ✅ "All Channels" shows all chats
4. ✅ Incoming messages appear on correct phone
5. ✅ Outgoing messages use selected phone
6. ✅ Templates work with selected phone

### When Something is Wrong
1. ❌ Dropdown missing or shows only 1 phone
2. ❌ Selecting phone doesn't change chat list
3. ❌ All chats show regardless of selection
4. ❌ Messages appear on wrong phone
5. ❌ Templates don't work with multiple phones

## Next Steps

1. **Identify the issue** using the scenarios above
2. **Run the debug script** to see database state
3. **Check logs** to see where filtering breaks
4. **Fix the issue** based on the root cause
5. **Test again** to verify fix works

## Support

If you're still having issues:
1. Run: `node scripts/debug_chats_by_number.js`
2. Share the output
3. Share the browser console logs
4. Share the server logs when selecting a phone
