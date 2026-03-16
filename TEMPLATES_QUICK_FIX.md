# Templates Not Loading - Quick Fix

## 5-Minute Diagnosis

### Step 1: Run Debug Script
```bash
cd backend
node scripts/debug_templates.js
```

### Step 2: Look for These Issues

**Issue 1: WABA ID is Empty**
```
Config 1:
  WABA ID: (empty)
```
**Fix**: Update database
```sql
UPDATE whatsapp_settings 
SET business_account_id = 'YOUR_WABA_ID' 
WHERE phone_number_id = 'YOUR_PHONE_ID';
```

**Issue 2: Token is Not Set**
```
Config 1:
  Token: NOT SET
```
**Fix**: Reconnect phone in Settings → WhatsApp

**Issue 3: API Error 401**
```
❌ ERROR: WhatsApp API error 401: Invalid OAuth token
```
**Fix**: Token expired, reconnect phone

**Issue 4: API Error 400**
```
❌ ERROR: WhatsApp API error 400: Invalid WABA ID
```
**Fix**: WABA ID is wrong, verify and update

**Issue 5: API Error 403**
```
❌ ERROR: WhatsApp API error 403: Insufficient permissions
```
**Fix**: Token doesn't have permissions, regenerate

**Issue 6: Empty Templates List**
```
✅ SUCCESS: Found 0 templates
```
**Fix**: No templates in WABA, create them in Meta Business Suite

## Most Common Fix

**90% of the time, the issue is:**
1. WABA ID is empty in database
2. Token is expired

**Quick fix:**
```bash
# 1. Check what's in database
SELECT phone_number_id, business_account_id, permanent_token 
FROM whatsapp_settings;

# 2. If WABA ID is empty, update it
UPDATE whatsapp_settings 
SET business_account_id = 'YOUR_WABA_ID' 
WHERE phone_number_id = 'YOUR_PHONE_ID';

# 3. If token is empty or expired, reconnect in Settings
```

## For Specific Phone

```bash
# Test specific phone
node scripts/debug_templates.js 921055841100882

# Check database for that phone
SELECT * FROM whatsapp_settings 
WHERE phone_number_id = '921055841100882';

# Update if needed
UPDATE whatsapp_settings 
SET business_account_id = 'WABA_ID', 
    permanent_token = 'TOKEN'
WHERE phone_number_id = '921055841100882';
```

## Verify Fix

1. Run debug script again
2. Should see "✅ SUCCESS: Found X templates"
3. Open Templates page in browser
4. Should see templates for that phone

## If Still Not Working

1. Check token expiration in Meta Business Suite
2. Verify WABA ID is correct
3. Regenerate token with correct permissions
4. Reconnect phone number
5. Run debug script again
