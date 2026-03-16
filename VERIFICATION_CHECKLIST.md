# Chat Filtering Verification Checklist

## Pre-Flight Check

Before running tests, verify the setup:

- [ ] You have 2+ WhatsApp phone numbers connected in Settings
- [ ] You have received messages on each phone number
- [ ] Backend is running
- [ ] Frontend is running
- [ ] Database is accessible

## Phase 1: Data Verification

### 1.1 Check Database State

Run this command:
```bash
cd backend
node scripts/debug_chats_by_number.js
```

Expected output:
```
=== DEBUGGING CHATS BY PHONE NUMBER ===

1. ALL CHANNELS IN DATABASE:
Found X channels:
  - whatsapp | 921055841100882 | +91 205 584 1100882 | Active: true
  - whatsapp | 919876543210 | +91 987 654 3210 | Active: true

2. WHATSAPP SETTINGS IN DATABASE:
Found X settings:
  - Team: team-id | Phone: 921055841100882 | Display: +91 205 584 1100882 | Active: true
  - Team: team-id | Phone: 919876543210 | Display: +91 987 654 3210 | Active: true

3. CONVERSATIONS AND THEIR CHANNELS:
Found X conversations:
  - Conv: abc123... | Phone: 921055841100882 | Contact: 919876543210 | Messages: 5 | Status: open
  - Conv: def456... | Phone: 919876543210 | Contact: 918765432109 | Messages: 3 | Status: open

4. CONVERSATIONS PER PHONE NUMBER:
Phone number breakdown:
  - 921055841100882: 5 conversations, 25 messages
  - 919876543210: 3 conversations, 15 messages
```

**Verification**:
- [ ] Multiple phones are listed
- [ ] Each phone has conversations
- [ ] Phone numbers match between channels and settings
- [ ] Message counts are reasonable

### 1.2 Check for Phone Number Mismatches

Run this SQL query:
```sql
SELECT 
  DISTINCT ch.external_id as channel_phone,
  CASE 
    WHEN ws.phone_number_id IS NOT NULL THEN 'MATCHED'
    ELSE 'NOT IN SETTINGS'
  END as status
FROM channels ch
LEFT JOIN whatsapp_settings ws ON ws.phone_number_id = ch.external_id
WHERE ch.type = 'whatsapp'
ORDER BY ch.external_id;
```

Expected output:
```
channel_phone      | status
921055841100882    | MATCHED
919876543210       | MATCHED
```

**Verification**:
- [ ] All channels show "MATCHED"
- [ ] No "NOT IN SETTINGS" entries
- [ ] Phone numbers are consistent

## Phase 2: Frontend Verification

### 2.1 Check Linked Phones Fetch

1. Open browser DevTools (F12)
2. Go to Console tab
3. Refresh the page
4. Look for this log:
   ```
   [Settings] Fetched WhatsApp settings: [
     { phone: '921055841100882', display: '+91 205 584 1100882' },
     { phone: '919876543210', display: '+91 987 654 3210' }
   ]
   ```

**Verification**:
- [ ] Log appears in console
- [ ] Multiple phones are listed
- [ ] Phone numbers are correct

### 2.2 Check Dropdown Visibility

1. Look at the chat page
2. Above the conversation list, find the phone number dropdown
3. It should say "All Channels" by default

**Verification**:
- [ ] Dropdown is visible
- [ ] It shows "All Channels" option
- [ ] It shows individual phone numbers

### 2.3 Check Phone Selection

1. Open DevTools Console
2. Select a phone number from dropdown
3. Look for this log:
   ```
   [Inbox] Loading with filter=open, phoneNumberId=921055841100882
   [Inbox] Loaded 5 conversations
   ```

**Verification**:
- [ ] Log appears immediately after selection
- [ ] `phoneNumberId` is set to the selected phone
- [ ] Conversation count changes

## Phase 3: Backend Verification

### 3.1 Check Backend Logs

1. Look at backend server logs
2. When you select a phone, you should see:
   ```
   [InboxRoute] GET /inbox teamId=xxx filter=open phoneNumberId=921055841100882
   [InboxService] listConversations filter='open', userId=xxx, phone='921055841100882'
   [InboxService] Filtering by phone number: 921055841100882
   ```

**Verification**:
- [ ] Logs appear in server output
- [ ] `phoneNumberId` is correct
- [ ] Filtering message appears

### 3.2 Check Network Request

1. Open DevTools Network tab
2. Select a phone number
3. Look for `/api/inbox?...` request
4. Check the URL:
   ```
   /api/inbox?teamId=xxx&filter=open&phoneNumberId=921055841100882
   ```

**Verification**:
- [ ] Request is made
- [ ] `phoneNumberId` parameter is present
- [ ] Parameter value is correct

## Phase 4: Functional Testing

### 4.1 Test Phone #1 Selection

**Steps**:
1. Select Phone #1 from dropdown
2. Wait for chats to load
3. Count the conversations shown

**Expected**:
- Only conversations from Phone #1 appear
- Count matches the debug script output

**Verification**:
- [ ] Correct phone's chats appear
- [ ] Other phone's chats don't appear
- [ ] Count is accurate

### 4.2 Test Phone #2 Selection

**Steps**:
1. Select Phone #2 from dropdown
2. Wait for chats to load
3. Count the conversations shown

**Expected**:
- Only conversations from Phone #2 appear
- Count matches the debug script output

**Verification**:
- [ ] Correct phone's chats appear
- [ ] Other phone's chats don't appear
- [ ] Count is accurate

### 4.3 Test "All Channels" Selection

**Steps**:
1. Select "All Channels" from dropdown
2. Wait for chats to load
3. Count the conversations shown

**Expected**:
- All conversations from all phones appear
- Count = Phone #1 count + Phone #2 count + ...

**Verification**:
- [ ] All chats appear
- [ ] Count is sum of all phones
- [ ] No chats are missing

### 4.4 Test Incoming Message

**Steps**:
1. Select Phone #1
2. Send a test message to Phone #1 from WhatsApp
3. Wait for message to appear
4. Select Phone #2
5. Verify message does NOT appear

**Expected**:
- Message appears in Phone #1 chats
- Message does NOT appear in Phone #2 chats
- Message appears in "All Channels"

**Verification**:
- [ ] Message appears on correct phone
- [ ] Message doesn't appear on wrong phone
- [ ] Message appears in "All Channels"

### 4.5 Test Outgoing Message

**Steps**:
1. Select Phone #1
2. Open a conversation
3. Send a message
4. Verify message is sent from Phone #1
5. Select Phone #2
6. Verify message doesn't appear there

**Expected**:
- Message is sent from Phone #1
- Message appears in Phone #1 chats
- Message doesn't appear in Phone #2 chats

**Verification**:
- [ ] Message sent from correct phone
- [ ] Message appears on correct phone
- [ ] Message doesn't appear on wrong phone

## Phase 5: Edge Cases

### 5.1 Test Rapid Phone Switching

**Steps**:
1. Rapidly switch between phones
2. Verify chats update correctly each time

**Expected**:
- Chats update immediately
- No stale data shown
- No errors in console

**Verification**:
- [ ] Switching works smoothly
- [ ] No console errors
- [ ] Correct chats shown each time

### 5.2 Test Page Refresh

**Steps**:
1. Select a phone
2. Refresh the page
3. Verify the phone is still selected
4. Verify correct chats appear

**Expected**:
- Phone selection is remembered
- Correct chats appear
- No errors

**Verification**:
- [ ] Phone selection persists
- [ ] Correct chats appear
- [ ] No console errors

### 5.3 Test with No Messages

**Steps**:
1. If you have a phone with no messages, select it
2. Verify empty state is shown correctly

**Expected**:
- Empty state message appears
- No errors
- Dropdown still works

**Verification**:
- [ ] Empty state shown
- [ ] No console errors
- [ ] Can switch to other phones

## Phase 6: Performance Check

### 6.1 Check Load Time

**Steps**:
1. Open DevTools Performance tab
2. Select a phone
3. Check how long it takes to load

**Expected**:
- Loads in < 1 second
- No performance warnings

**Verification**:
- [ ] Load time is acceptable
- [ ] No performance issues

### 6.2 Check Memory Usage

**Steps**:
1. Open DevTools Memory tab
2. Switch between phones several times
3. Check memory usage

**Expected**:
- Memory usage is stable
- No memory leaks

**Verification**:
- [ ] Memory is stable
- [ ] No memory leaks

## Summary Report

After completing all phases, fill in this summary:

```
VERIFICATION SUMMARY
====================

Phase 1: Data Verification
  - Debug script output: [PASS/FAIL]
  - Phone number matching: [PASS/FAIL]
  - Conversation counts: [PASS/FAIL]

Phase 2: Frontend Verification
  - Linked phones fetch: [PASS/FAIL]
  - Dropdown visibility: [PASS/FAIL]
  - Phone selection: [PASS/FAIL]

Phase 3: Backend Verification
  - Backend logs: [PASS/FAIL]
  - Network request: [PASS/FAIL]
  - Parameter passing: [PASS/FAIL]

Phase 4: Functional Testing
  - Phone #1 selection: [PASS/FAIL]
  - Phone #2 selection: [PASS/FAIL]
  - All Channels: [PASS/FAIL]
  - Incoming message: [PASS/FAIL]
  - Outgoing message: [PASS/FAIL]

Phase 5: Edge Cases
  - Rapid switching: [PASS/FAIL]
  - Page refresh: [PASS/FAIL]
  - No messages: [PASS/FAIL]

Phase 6: Performance
  - Load time: [PASS/FAIL]
  - Memory usage: [PASS/FAIL]

OVERALL STATUS: [PASS/FAIL]
```

## Troubleshooting

If any phase fails, refer to:
- **Phase 1 fails**: See `DATABASE_VERIFICATION_QUERIES.sql`
- **Phase 2 fails**: See `QUICK_TEST_GUIDE.md` → Scenario 1
- **Phase 3 fails**: See `QUICK_TEST_GUIDE.md` → Scenario 2
- **Phase 4 fails**: See `CHAT_FILTERING_FIX.md` → Common Issues
- **Phase 5 fails**: See `QUICK_TEST_GUIDE.md` → Edge Cases
- **Phase 6 fails**: Check browser performance tools

## Sign-Off

- [ ] All phases completed
- [ ] All tests passed
- [ ] No console errors
- [ ] No server errors
- [ ] Chat filtering working correctly
- [ ] Ready for production

**Date Completed**: _______________
**Verified By**: _______________
**Notes**: _______________
