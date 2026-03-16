# Templates Loading - Error Codes & Solutions

## Error Code Reference

### ✅ SUCCESS: Found X Templates
**Meaning**: Templates loaded successfully
**Action**: None needed, templates should appear in UI

### ❌ WABA ID is Empty
**Meaning**: `business_account_id` is NULL in database
**Cause**: Phone number connected but WABA ID not saved
**Solution**:
```sql
UPDATE whatsapp_settings 
SET business_account_id = 'YOUR_WABA_ID' 
WHERE phone_number_id = 'YOUR_PHONE_ID';
```

### ❌ Token is NOT SET
**Meaning**: `permanent_token` is NULL in database
**Cause**: Phone number connected but token not saved
**Solution**: Reconnect phone in Settings → WhatsApp

### ❌ WhatsApp API error 400: Invalid WABA ID
**HTTP Status**: 400 Bad Request
**Meaning**: WABA ID doesn't exist or is invalid
**Cause**: 
- WABA ID is wrong
- WABA was deleted
- WABA is archived
**Solution**:
1. Verify WABA ID in Meta Business Suite
2. Update database with correct WABA ID
```sql
UPDATE whatsapp_settings 
SET business_account_id = 'CORRECT_WABA_ID' 
WHERE phone_number_id = 'YOUR_PHONE_ID';
```

### ❌ WhatsApp API error 401: Invalid OAuth token
**HTTP Status**: 401 Unauthorized
**Meaning**: Token is invalid or expired
**Cause**:
- Token expired (usually after 60 days)
- Token was revoked
- Token is corrupted
**Solution**: Reconnect phone in Settings → WhatsApp to get new token

### ❌ WhatsApp API error 403: Insufficient permissions
**HTTP Status**: 403 Forbidden
**Meaning**: Token doesn't have required permissions
**Cause**: Token lacks `whatsapp_business_messaging` scope
**Solution**:
1. Go to Meta Business Suite
2. Regenerate token with correct permissions
3. Reconnect phone in Settings → WhatsApp

### ❌ WhatsApp API error 404: Not Found
**HTTP Status**: 404 Not Found
**Meaning**: WABA ID doesn't exist
**Cause**: WABA was deleted or doesn't belong to this app
**Solution**:
1. Verify WABA ID is correct
2. Verify WABA belongs to your app
3. Update database with correct WABA ID

### ❌ WhatsApp API error 429: Rate Limited
**HTTP Status**: 429 Too Many Requests
**Meaning**: Too many API calls
**Cause**: Hitting Meta API rate limits
**Solution**: Wait a few minutes and try again

### ❌ WhatsApp API error 500: Internal Server Error
**HTTP Status**: 500 Internal Server Error
**Meaning**: Meta API server error
**Cause**: Temporary issue on Meta's side
**Solution**: Wait a few minutes and try again

### ⚠️ Found 0 Templates
**Meaning**: API call succeeded but no templates found
**Cause**:
- No templates created in WABA
- Templates are in draft status
- Templates are archived
**Solution**:
1. Create templates in Meta Business Suite
2. Or use local templates
3. Or check if templates are archived

## Debug Script Output Interpretation

### Good Output
```
3. RESOLVED CONFIGS:
  Config 1:
    Phone: 921055841100882
    WABA ID: 3836731576631503
    Token: ***SET***
    Custom: true

4. TESTING TEMPLATE FETCH:
  Testing WABA: 3836731576631503 (Phone: 921055841100882)
    ✅ SUCCESS: Found 5 templates
    First 3 templates:
      - hello_world (APPROVED)
      - order_confirmation (APPROVED)
      - payment_reminder (APPROVED)
```
**Meaning**: Everything is working correctly

### Bad Output - Empty WABA ID
```
3. RESOLVED CONFIGS:
  Config 1:
    Phone: 921055841100882
    WABA ID: (empty)
    Token: ***SET***
    Custom: true

4. TESTING TEMPLATE FETCH:
  Testing WABA: (empty) (Phone: 921055841100882)
    ⚠️  WABA ID is empty for phone 921055841100882
```
**Fix**: Update database with WABA ID

### Bad Output - Empty Token
```
3. RESOLVED CONFIGS:
  Config 1:
    Phone: 921055841100882
    WABA ID: 3836731576631503
    Token: NOT SET
    Custom: true

4. TESTING TEMPLATE FETCH:
  Testing WABA: 3836731576631503 (Phone: 921055841100882)
    ❌ ERROR: WhatsApp Token is required for real WhatsApp API calls
```
**Fix**: Reconnect phone to get token

### Bad Output - Invalid Token
```
4. TESTING TEMPLATE FETCH:
  Testing WABA: 3836731576631503 (Phone: 921055841100882)
    ❌ ERROR: WhatsApp API error 401: Invalid OAuth token
    Response: {
      "error": {
        "message": "Invalid OAuth token",
        "type": "OAuthException",
        "code": 190
      }
    }
```
**Fix**: Token expired, reconnect phone

### Bad Output - Invalid WABA ID
```
4. TESTING TEMPLATE FETCH:
  Testing WABA: 9999999999999999 (Phone: 921055841100882)
    ❌ ERROR: WhatsApp API error 400: Invalid WABA ID
    Response: {
      "error": {
        "message": "Invalid WABA ID",
        "type": "OAuthException",
        "code": 100
      }
    }
```
**Fix**: WABA ID is wrong, verify and update

### Bad Output - Insufficient Permissions
```
4. TESTING TEMPLATE FETCH:
  Testing WABA: 3836731576631503 (Phone: 921055841100882)
    ❌ ERROR: WhatsApp API error 403: Insufficient permissions
    Response: {
      "error": {
        "message": "Insufficient permissions",
        "type": "OAuthException",
        "code": 10
      }
    }
```
**Fix**: Token lacks permissions, regenerate

## Quick Reference Table

| Error | HTTP | Cause | Fix |
|-------|------|-------|-----|
| Empty WABA ID | N/A | Not saved | Update DB |
| Empty Token | N/A | Not saved | Reconnect |
| Invalid WABA ID | 400 | Wrong ID | Verify & update |
| Invalid Token | 401 | Expired | Reconnect |
| Insufficient Permissions | 403 | Wrong scope | Regenerate |
| Not Found | 404 | Deleted | Verify |
| Rate Limited | 429 | Too many calls | Wait |
| Server Error | 500 | Meta issue | Wait |
| No Templates | 200 | None created | Create |

## Step-by-Step Troubleshooting

### Step 1: Run Debug Script
```bash
node scripts/debug_templates.js [phoneNumberId]
```

### Step 2: Check Output
- Look for ✅ SUCCESS or ❌ ERROR
- Note the error code if present

### Step 3: Match Error to Table Above
- Find your error in the table
- Follow the "Fix" column

### Step 4: Apply Fix
- Update database, or
- Reconnect phone, or
- Regenerate token

### Step 5: Verify
- Run debug script again
- Should see ✅ SUCCESS

### Step 6: Test Frontend
- Open Templates page
- Select phone
- Should see templates

## Common Error Combinations

### Scenario 1: New Phone Connected
```
WABA ID: (empty)
Token: ***SET***
Error: WABA ID is empty
```
**Fix**: Update database with WABA ID from onboarding response

### Scenario 2: Token Expired
```
WABA ID: 3836731576631503
Token: ***SET***
Error: WhatsApp API error 401: Invalid OAuth token
```
**Fix**: Reconnect phone to get new token

### Scenario 3: Wrong WABA ID
```
WABA ID: 9999999999999999
Token: ***SET***
Error: WhatsApp API error 400: Invalid WABA ID
```
**Fix**: Verify WABA ID in Meta Business Suite and update

### Scenario 4: Token Lacks Permissions
```
WABA ID: 3836731576631503
Token: ***SET***
Error: WhatsApp API error 403: Insufficient permissions
```
**Fix**: Regenerate token with `whatsapp_business_messaging` permission

### Scenario 5: No Templates Created
```
WABA ID: 3836731576631503
Token: ***SET***
Success: Found 0 templates
```
**Fix**: Create templates in Meta Business Suite

## Prevention

### To Avoid These Errors

1. **Always verify WABA ID**
   - Check in Meta Business Suite
   - Save to database immediately

2. **Always verify token**
   - Check it's not empty
   - Check it's not expired

3. **Always verify permissions**
   - Ensure `whatsapp_business_messaging` scope
   - Regenerate if unsure

4. **Always test after connecting**
   - Run debug script
   - Verify templates load

5. **Always monitor token expiration**
   - Tokens expire after ~60 days
   - Reconnect periodically

## Support

### If Error Persists

1. **Check database directly**
   ```sql
   SELECT * FROM whatsapp_settings 
   WHERE phone_number_id = 'YOUR_PHONE_ID';
   ```

2. **Verify in Meta Business Suite**
   - Check WABA ID exists
   - Check token is valid
   - Check permissions

3. **Reconnect phone**
   - Go to Settings → WhatsApp
   - Disconnect phone
   - Reconnect with new token

4. **Run debug script again**
   - Should see ✅ SUCCESS

5. **Contact support**
   - Share debug script output
   - Share error message
   - Share database query results
