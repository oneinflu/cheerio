# Templates Not Loading for Particular WABA ID - Debugging Guide

## Problem
Templates are not loading for a specific WABA ID / Business Account ID, even though the phone number is connected.

## Root Causes

### 1. WABA ID is Empty or Null
**Symptom**: No templates appear, no error in logs
**Cause**: `business_account_id` is not saved in `whatsapp_settings`
**Fix**: 
```sql
-- Check if WABA ID is set
SELECT phone_number_id, business_account_id FROM whatsapp_settings;

-- If empty, update it
UPDATE whatsapp_settings 
SET business_account_id = 'YOUR_WABA_ID' 
WHERE phone_number_id = 'YOUR_PHONE_ID';
```

### 2. Invalid or Expired Token
**Symptom**: API error 401 or 403
**Cause**: Token is invalid, expired, or doesn't have permission
**Fix**:
- Reconnect the phone number in Settings → WhatsApp
- Ensure token has `whatsapp_business_messaging` permission
- Check token expiration in Meta Business Suite

### 3. WABA ID Doesn't Match Token
**Symptom**: API error 400 or 404
**Cause**: Token is for a different WABA ID
**Fix**:
- Verify WABA ID matches the one in Meta Business Suite
- Reconnect with correct WABA ID
- Check if WABA was deleted or archived

### 4. Token Doesn't Have Template Permissions
**Symptom**: API error 200 but empty templates list
**Cause**: Token lacks `whatsapp_business_messaging` scope
**Fix**:
- Regenerate token with correct permissions
- Ensure app has `whatsapp_business_messaging` permission
- Reconnect phone number

### 5. No Templates Created in WABA
**Symptom**: Empty templates list (but no error)
**Cause**: No templates have been created in this WABA
**Fix**:
- Create templates in Meta Business Suite
- Or create templates via API
- Or use local templates

## Quick Diagnosis

### Step 1: Run Debug Script
```bash
cd backend
node scripts/debug_templates.js [phoneNumberId]
```

Expected output:
```
1. ENVIRONMENT VARIABLES:
  - WHATSAPP_PHONE_NUMBER_ID: 921055841100882
  - WHATSAPP_BUSINESS_ACCOUNT_ID: 3836731576631503
  - WHATSAPP_TOKEN: ***SET***

2. DATABASE WHATSAPP SETTINGS:
Found 2 settings:
  - Phone: 921055841100882
    WABA ID: 3836731576631503
    Display: +91 205 584 1100882
    Active: true
    Token: ***SET***

3. RESOLVED CONFIGS:
  Config 1:
    Phone: 921055841100882
    WABA ID: 3836731576631503
    Token: ***SET***
    Custom: true

4. TESTING TEMPLATE FETCH:
  Testing WABA: 3836731576631503 (Phone: 921055841100882)
    Calling: whatsappClient.getTemplates(3836731576631503, 100, config)
    ✅ SUCCESS: Found 5 templates
    First 3 templates:
      - hello_world (APPROVED)
      - order_confirmation (APPROVED)
      - payment_reminder (APPROVED)
```

### Step 2: Check for Errors
Look for these error patterns:

**❌ WABA ID is empty**
```
Config 1:
  Phone: 921055841100882
  WABA ID: (empty)
  Token: ***SET***
```
**Fix**: Update `business_account_id` in database

**❌ Token is not set**
```
Config 1:
  Phone: 921055841100882
  WABA ID: 3836731576631503
  Token: NOT SET
```
**Fix**: Reconnect phone number in Settings

**❌ API Error 401**
```
Testing WABA: 3836731576631503
  ❌ ERROR: WhatsApp API error 401: Invalid OAuth token
```
**Fix**: Token is invalid or expired, reconnect

**❌ API Error 400**
```
Testing WABA: 3836731576631503
  ❌ ERROR: WhatsApp API error 400: Invalid WABA ID
```
**Fix**: WABA ID doesn't match token, verify and update

**❌ API Error 403**
```
Testing WABA: 3836731576631503
  ❌ ERROR: WhatsApp API error 403: Insufficient permissions
```
**Fix**: Token doesn't have template permissions

### Step 3: Check Frontend
1. Open DevTools (F12)
2. Go to Network tab
3. Click on Templates page
4. Look for `/api/templates` request
5. Check response for errors

## Common Issues & Solutions

### Issue 1: Templates Show for Default Phone but Not Custom Phone

**Cause**: Custom phone's WABA ID or token is wrong

**Solution**:
```bash
# Run debug script for specific phone
node scripts/debug_templates.js 921055841100882

# Check if WABA ID is set
SELECT business_account_id FROM whatsapp_settings 
WHERE phone_number_id = '921055841100882';

# If empty, update it
UPDATE whatsapp_settings 
SET business_account_id = 'CORRECT_WABA_ID' 
WHERE phone_number_id = '921055841100882';
```

### Issue 2: Templates Loaded Once, Then Stopped Loading

**Cause**: Token expired

**Solution**:
1. Go to Settings → WhatsApp
2. Disconnect the phone
3. Reconnect with new token
4. Verify templates load

### Issue 3: Templates Load But Show Empty List

**Cause**: No templates in WABA or permission issue

**Solution**:
1. Check Meta Business Suite for templates
2. If none exist, create templates there
3. Or check token permissions
4. Regenerate token if needed

### Issue 4: Only Some Phones Show Templates

**Cause**: Some phones have invalid WABA ID or token

**Solution**:
```bash
# Check all phones
node scripts/debug_templates.js

# For each phone without templates:
# 1. Verify WABA ID in database
# 2. Verify token is set
# 3. Reconnect if needed
```

## Database Queries

### Check All Settings
```sql
SELECT 
  phone_number_id,
  business_account_id,
  permanent_token,
  display_phone_number,
  is_active,
  created_at
FROM whatsapp_settings
ORDER BY created_at DESC;
```

### Check Specific Phone
```sql
SELECT 
  phone_number_id,
  business_account_id,
  permanent_token,
  is_active
FROM whatsapp_settings
WHERE phone_number_id = '921055841100882';
```

### Update WABA ID
```sql
UPDATE whatsapp_settings
SET business_account_id = '3836731576631503'
WHERE phone_number_id = '921055841100882';
```

### Update Token
```sql
UPDATE whatsapp_settings
SET permanent_token = 'NEW_TOKEN_HERE'
WHERE phone_number_id = '921055841100882';
```

### Check Local Templates
```sql
SELECT name, language, status, created_at
FROM whatsapp_templates
ORDER BY created_at DESC;
```

## Testing

### Test 1: Verify Config is Correct
```bash
node scripts/debug_templates.js 921055841100882
```
Check that WABA ID and token are set

### Test 2: Verify API Call Works
Look for "✅ SUCCESS" in debug output

### Test 3: Verify Frontend Loads
1. Open Templates page
2. Select phone from dropdown
3. Verify templates appear

### Test 4: Verify Specific Phone
```bash
# Test specific phone
node scripts/debug_templates.js 921055841100882

# Should show templates for that phone
```

## Verification Checklist

- [ ] Run debug script: `node scripts/debug_templates.js`
- [ ] Check WABA ID is not empty
- [ ] Check token is set
- [ ] Check token is valid (not expired)
- [ ] Check WABA ID matches token
- [ ] Check token has template permissions
- [ ] Check templates exist in WABA
- [ ] Check frontend loads templates
- [ ] Test with each phone number
- [ ] Verify dropdown shows all phones

## Next Steps

1. **Run debug script** to identify the issue
2. **Check database** for WABA ID and token
3. **Verify API call** works
4. **Reconnect phone** if needed
5. **Test frontend** to verify templates load

## Support

If templates still don't load:

1. Run: `node scripts/debug_templates.js [phoneNumberId]`
2. Share the output
3. Check the error message
4. Follow the solution for that error
5. Verify fix works
