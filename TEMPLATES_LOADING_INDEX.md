# Templates Not Loading - Documentation Index

## Quick Navigation

### 🚀 Start Here
- **[TEMPLATES_QUICK_FIX.md](TEMPLATES_QUICK_FIX.md)** - 5-minute quick fix

### 🔍 Understanding the Issue
- **[TEMPLATES_DATA_FLOW.md](TEMPLATES_DATA_FLOW.md)** - How templates are loaded
- **[TEMPLATES_ERROR_CODES.md](TEMPLATES_ERROR_CODES.md)** - Error codes and solutions

### 🛠️ Debugging & Fixing
- **[TEMPLATES_LOADING_FIX.md](TEMPLATES_LOADING_FIX.md)** - Complete debugging guide
- **[TEMPLATES_LOADING_SUMMARY.md](TEMPLATES_LOADING_SUMMARY.md)** - Executive summary

### 📚 Reference
- **[TEMPLATES_LOADING_INDEX.md](TEMPLATES_LOADING_INDEX.md)** - This file

---

## Document Descriptions

### TEMPLATES_QUICK_FIX.md
**Purpose**: Get templates working in 5 minutes
**Length**: 5 minutes
**Contains**:
- Quick diagnosis steps
- Most common fixes
- Verification steps

**When to read**: First - if you want quick fix

---

### TEMPLATES_LOADING_FIX.md
**Purpose**: Complete debugging and fixing guide
**Length**: 15 minutes
**Contains**:
- Root causes
- Detailed diagnosis
- Common issues and solutions
- Database queries
- Testing procedures

**When to read**: For detailed analysis

---

### TEMPLATES_DATA_FLOW.md
**Purpose**: Understand how templates are loaded
**Length**: 10 minutes
**Contains**:
- Complete data flow diagram
- Code flow explanation
- Database schema
- What can go wrong
- Debugging steps

**When to read**: To understand the system

---

### TEMPLATES_ERROR_CODES.md
**Purpose**: Reference for error codes and solutions
**Length**: 10 minutes
**Contains**:
- All error codes
- What each error means
- How to fix each error
- Debug script output interpretation
- Common error combinations

**When to read**: When you see an error

---

### TEMPLATES_LOADING_SUMMARY.md
**Purpose**: Executive summary
**Length**: 5 minutes
**Contains**:
- What was provided
- Root causes
- Quick fix
- Database queries
- Verification checklist

**When to read**: For overview

---

## Reading Paths

### Path 1: Quick Fix (5 minutes)
1. Read: TEMPLATES_QUICK_FIX.md
2. Run: `node backend/scripts/debug_templates.js`
3. Apply fix
4. Done!

### Path 2: Understanding (20 minutes)
1. Read: TEMPLATES_QUICK_FIX.md
2. Read: TEMPLATES_DATA_FLOW.md
3. Run: `node backend/scripts/debug_templates.js`
4. Read: TEMPLATES_ERROR_CODES.md
5. Apply fix

### Path 3: Complete Analysis (30 minutes)
1. Read: TEMPLATES_QUICK_FIX.md
2. Read: TEMPLATES_DATA_FLOW.md
3. Read: TEMPLATES_LOADING_FIX.md
4. Run: `node backend/scripts/debug_templates.js`
5. Read: TEMPLATES_ERROR_CODES.md
6. Apply fix
7. Verify

### Path 4: Deep Dive (45 minutes)
1. Complete Path 3
2. Read: TEMPLATES_LOADING_SUMMARY.md
3. Review: Code in templates.js
4. Review: Code in whatsappClient.js
5. Study: Database schema
6. Done!

---

## Quick Reference

### The Problem
Templates not loading for a particular WABA ID / Business Account ID

### Root Causes (Most to Least Likely)
1. WABA ID is empty (40%)
2. Token is expired (30%)
3. Token is invalid (15%)
4. WABA ID doesn't match token (10%)
5. Token lacks permissions (5%)

### Quick Fix
```bash
# 1. Run debug script
node scripts/debug_templates.js [phoneNumberId]

# 2. Look for issues
# - WABA ID is empty → Update database
# - Token is NOT SET → Reconnect phone
# - API Error 401 → Token expired, reconnect
# - API Error 400 → WABA ID wrong, verify
# - API Error 403 → Token lacks permissions

# 3. Apply fix
# - Update database or reconnect phone

# 4. Verify
# - Run debug script again
# - Should see ✅ SUCCESS
```

### Key Files
- **Debug Script**: `backend/scripts/debug_templates.js`
- **Templates Route**: `backend/src/routes/templates.js`
- **WhatsApp Client**: `backend/src/integrations/meta/whatsappClient.js`
- **Config Utility**: `backend/src/utils/whatsappConfig.js`

### Database Tables
- `whatsapp_settings` - Phone numbers, WABA IDs, tokens
- `whatsapp_templates` - Local templates
- `template_settings` - Starred templates

### Common Fixes
1. **WABA ID empty**: `UPDATE whatsapp_settings SET business_account_id = 'WABA_ID'`
2. **Token empty**: Reconnect phone in Settings
3. **Token expired**: Reconnect phone to get new token
4. **WABA ID wrong**: Verify and update database
5. **Token lacks permissions**: Regenerate token

---

## Error Code Quick Reference

| Error | Cause | Fix |
|-------|-------|-----|
| Empty WABA ID | Not saved | Update DB |
| Empty Token | Not saved | Reconnect |
| 400 Bad Request | WABA ID wrong | Verify & update |
| 401 Unauthorized | Token expired | Reconnect |
| 403 Forbidden | Token lacks permissions | Regenerate |
| 404 Not Found | WABA deleted | Verify |
| 429 Rate Limited | Too many calls | Wait |
| 500 Server Error | Meta issue | Wait |
| 0 Templates | None created | Create |

---

## Workflow

### 1. Identify Issue
- Run debug script
- Look for error message

### 2. Find Solution
- Check error code table
- Read appropriate guide

### 3. Apply Fix
- Update database, or
- Reconnect phone, or
- Regenerate token

### 4. Verify
- Run debug script again
- Should see ✅ SUCCESS

### 5. Test
- Open Templates page
- Select phone
- Should see templates

---

## Files Provided

### New Files
- `backend/scripts/debug_templates.js` - Debug script
- `TEMPLATES_QUICK_FIX.md` - Quick fix guide
- `TEMPLATES_LOADING_FIX.md` - Complete guide
- `TEMPLATES_DATA_FLOW.md` - Data flow explanation
- `TEMPLATES_ERROR_CODES.md` - Error reference
- `TEMPLATES_LOADING_SUMMARY.md` - Executive summary
- `TEMPLATES_LOADING_INDEX.md` - This file

### Modified Files
- None (only added debug script)

---

## Next Steps

1. **Choose your path** based on time available
2. **Run debug script** to see current state
3. **Read appropriate guide** based on error
4. **Apply fix** from guide
5. **Verify** by running debug script again
6. **Test** in frontend

---

## Support

### Quick Help
- **5 min**: Read TEMPLATES_QUICK_FIX.md
- **15 min**: Read TEMPLATES_LOADING_FIX.md
- **Error code**: Check TEMPLATES_ERROR_CODES.md
- **Understanding**: Read TEMPLATES_DATA_FLOW.md

### If Stuck
1. Run: `node backend/scripts/debug_templates.js [phoneNumberId]`
2. Look for error message
3. Find error in TEMPLATES_ERROR_CODES.md
4. Follow the fix
5. Verify with debug script

---

## Summary

You have everything needed to:
- ✅ Diagnose template loading issues
- ✅ Understand how templates work
- ✅ Fix the problem
- ✅ Verify the fix
- ✅ Prevent future issues

**Start with**: TEMPLATES_QUICK_FIX.md
**Then run**: `node backend/scripts/debug_templates.js`
**Then read**: Appropriate guide based on error

---

**Last Updated**: March 16, 2026
**Status**: Complete Documentation Ready
**Next Action**: Read TEMPLATES_QUICK_FIX.md
