# Templates Data Flow - How Templates Are Loaded

## The Flow

```
Frontend (TemplatesPage.jsx)
  ↓
  1. Fetch: GET /api/settings/whatsapp
  ↓
Backend (whatsappAuth.js)
  ↓
  2. Query: SELECT * FROM whatsapp_settings WHERE team_id = $1
  ↓
Database
  ↓
  Returns: [
    { phone_number_id: '921055841100882', business_account_id: '3836731576631503', permanent_token: 'EAA...', ... },
    { phone_number_id: '919876543210', business_account_id: '3836731576631504', permanent_token: 'EAA...', ... }
  ]
  ↓
Frontend
  ↓
  3. Store: setLinkedPhones(data.allSettings)
  ↓
  4. Render: Dropdown with all phones
  ↓
  5. User selects phone or clicks "All Accounts"
  ↓
  6. Fetch: GET /api/templates?phoneNumberId=921055841100882
  ↓
Backend (templates.js)
  ↓
  7. Extract: phoneNumberId from query
  ↓
  8. Get config: waConfig.getConfigByPhone(phoneNumberId)
  ↓
  9. Query: SELECT * FROM whatsapp_settings WHERE phone_number_id = $1
  ↓
Database
  ↓
  Returns: {
    phone_number_id: '921055841100882',
    business_account_id: '3836731576631503',
    permanent_token: 'EAA...',
    display_phone_number: '+91 205 584 1100882'
  }
  ↓
Backend
  ↓
  10. Extract: wabaId = '3836731576631503', token = 'EAA...'
  ↓
  11. Call: whatsappClient.getTemplates(wabaId, 100, config)
  ↓
Meta API (graph.facebook.com)
  ↓
  12. Request: GET /v21.0/3836731576631503/message_templates
       Headers: Authorization: Bearer EAA...
  ↓
  13. Response: {
    data: [
      { id: '123', name: 'hello_world', status: 'APPROVED', ... },
      { id: '124', name: 'order_confirmation', status: 'APPROVED', ... },
      ...
    ]
  }
  ↓
Backend
  ↓
  14. Tag templates: Add wabaId, phoneNumberId, displayPhoneNumber
  ↓
  15. Fetch local templates: SELECT * FROM whatsapp_templates
  ↓
  16. Merge: [...metaTemplates, ...localTemplates]
  ↓
  17. Add starred status: Check template_settings table
  ↓
  18. Return: res.json({ data: enriched })
  ↓
Frontend
  ↓
  19. Receive: templates array
  ↓
  20. Store: setTemplates(data)
  ↓
  21. Render: Template list
```

## Key Points

### 1. Phone Number Must Be in Settings
```
whatsapp_settings table must have:
- phone_number_id (e.g., '921055841100882')
- business_account_id (e.g., '3836731576631503')
- permanent_token (e.g., 'EAA...')
- is_active = true
```

### 2. WABA ID Must Not Be Empty
```javascript
// In templates.js
const wabaId = config.businessAccountId;
if (!wabaId) continue;  // Skips if empty!
```

### 3. Token Must Be Valid
```javascript
// In whatsappClient.js
if (!token || token === 'placeholder_token') {
  throw new Error('WhatsApp Token is required');
}
```

### 4. API Call Uses WABA ID and Token
```
GET /v21.0/{wabaId}/message_templates
Authorization: Bearer {token}
```

### 5. Error Handling
```javascript
// If API call fails, error is caught and logged
try {
  const resp = await whatsappClient.getTemplates(wabaId, 100, config);
  // Process templates
} catch (apiErr) {
  console.error(`Failed to fetch for WABA ${wabaId}:`, apiErr.message);
  // Continue with next WABA
}
```

## What Can Go Wrong

### 1. WABA ID is Empty
```
Config: { phoneNumberId: '921055841100882', businessAccountId: '', token: 'EAA...' }
Result: Skipped (if (!wabaId) continue;)
```

### 2. Token is Empty
```
Config: { phoneNumberId: '921055841100882', businessAccountId: '3836731576631503', token: '' }
Result: Error thrown
```

### 3. Token is Invalid
```
API Call: GET /v21.0/3836731576631503/message_templates
Authorization: Bearer INVALID_TOKEN
Response: 401 Unauthorized
Result: Error caught and logged
```

### 4. WABA ID Doesn't Match Token
```
API Call: GET /v21.0/WRONG_WABA_ID/message_templates
Authorization: Bearer TOKEN_FOR_DIFFERENT_WABA
Response: 400 Bad Request
Result: Error caught and logged
```

### 5. Token Doesn't Have Permissions
```
API Call: GET /v21.0/3836731576631503/message_templates
Authorization: Bearer TOKEN_WITHOUT_PERMISSIONS
Response: 403 Forbidden
Result: Error caught and logged
```

## Database Schema

### whatsapp_settings Table
```sql
CREATE TABLE whatsapp_settings (
  id UUID PRIMARY KEY,
  team_id UUID,
  phone_number_id VARCHAR(255),
  business_account_id VARCHAR(255),
  permanent_token TEXT,
  display_phone_number VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### whatsapp_templates Table
```sql
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  language VARCHAR(10),
  category VARCHAR(50),
  components JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### template_settings Table
```sql
CREATE TABLE template_settings (
  id UUID PRIMARY KEY,
  template_name VARCHAR(255),
  is_starred BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Code Flow

### Frontend (TemplatesPage.jsx)
```javascript
// 1. Fetch linked phones
useEffect(() => {
  const fetchPhones = async () => {
    const res = await fetch('/api/settings/whatsapp');
    const data = await res.json();
    setLinkedPhones(data.allSettings || []);
  };
  fetchPhones();
}, []);

// 2. Fetch templates when phone changes
useEffect(() => {
  loadTemplates();
}, [selectedPhoneNumberId]);

// 3. Load templates
const loadTemplates = async () => {
  const pid = selectedPhoneNumberId === 'ALL' ? null : selectedPhoneNumberId;
  const res = await getTemplates(pid);
  setTemplates(res.data);
};
```

### Backend (templates.js)
```javascript
// 1. Get config for phone
let configs = [];
if (phoneNumberId) {
  const config = await waConfig.getConfigByPhone(phoneNumberId);
  if (config.isCustom || config.phoneNumberId) configs = [config];
} else {
  configs = await waConfig.getAllConfigs(teamId);
}

// 2. Fetch templates for each config
let allMetaTemplates = [];
for (const config of configs) {
  const wabaId = config.businessAccountId;
  if (!wabaId) continue;

  try {
    const resp = await whatsappClient.getTemplates(wabaId, 100, config);
    const metaTemplates = resp.data && resp.data.data ? resp.data.data : [];
    allMetaTemplates.push(...metaTemplates.map(t => ({
      ...t,
      wabaId,
      phoneNumberId: config.phoneNumberId
    })));
  } catch (apiErr) {
    console.error(`Failed to fetch for WABA ${wabaId}:`, apiErr.message);
  }
}

// 3. Return templates
res.json({ data: allMetaTemplates });
```

### Backend (whatsappClient.js)
```javascript
async function getTemplates(wabaId, limit = 100, customConfig = null) {
  const url = `${GRAPH_BASE}/${wabaId}/message_templates?limit=${limit}`;
  return getJSON(url, customConfig);
}

async function getJSON(url, customConfig = null) {
  const token = (customConfig && customConfig.token) || TOKEN;
  
  // Make HTTPS request
  const opts = {
    method: 'GET',
    hostname: 'graph.facebook.com',
    path: '/v21.0/...',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  };
  
  // Return response
  return new Promise((resolve, reject) => {
    // ... make request ...
  });
}
```

## Debugging Steps

### Step 1: Check Database
```sql
SELECT phone_number_id, business_account_id, permanent_token 
FROM whatsapp_settings;
```

### Step 2: Check Config Resolution
```bash
node scripts/debug_templates.js [phoneNumberId]
```

### Step 3: Check API Call
Look for logs:
```
[templates] Fetching templates for WABA: 3836731576631503 (Phone: 921055841100882)
```

### Step 4: Check Response
Look for:
```
✅ SUCCESS: Found X templates
```
or
```
❌ ERROR: WhatsApp API error XXX: ...
```

### Step 5: Check Frontend
Open DevTools → Network → Look for `/api/templates` response

## Common Fixes

### Fix 1: WABA ID is Empty
```sql
UPDATE whatsapp_settings 
SET business_account_id = 'YOUR_WABA_ID' 
WHERE phone_number_id = 'YOUR_PHONE_ID';
```

### Fix 2: Token is Empty
Reconnect phone in Settings → WhatsApp

### Fix 3: Token is Expired
Regenerate token in Meta Business Suite

### Fix 4: WABA ID is Wrong
Verify WABA ID in Meta Business Suite and update database

### Fix 5: Token Doesn't Have Permissions
Regenerate token with `whatsapp_business_messaging` permission
