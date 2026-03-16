# Templates vs Chats - Implementation Comparison

## Overview

Both Templates and Chats need to support multiple WhatsApp phone numbers. Templates are working correctly, so we use them as a reference for how Chats should work.

## Side-by-Side Comparison

### 1. FETCHING LINKED PHONES

#### Templates (Working ✅)
```javascript
// TemplatesPage.jsx
useEffect(() => {
  const fetchPhones = async () => {
    try {
      const res = await fetch('/api/settings/whatsapp');
      if (res.ok) {
        const data = await res.json();
        setLinkedPhones(data.allSettings || []);  // Gets all phones
      }
    } catch (e) {
      console.error("Failed to fetch linked phones", e);
    }
  };
  fetchPhones();
}, []);
```

#### Chats (Should be same ✅)
```javascript
// App.jsx
useEffect(() => {
  if (!storedUser) return;
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/whatsapp');
      if (res.ok) {
        const data = await res.json();
        setLinkedPhones(data.allSettings || []);  // Gets all phones
      }
    } catch (e) {
      console.error("Failed to fetch linked phones", e);
    }
  };
  fetchSettings();
}, [storedUser]);
```

**Status**: ✅ Both are identical

---

### 2. PHONE NUMBER SELECTION STATE

#### Templates (Working ✅)
```javascript
// TemplatesPage.jsx
const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState('ALL');

// Dropdown
<select value={selectedPhoneNumberId} onChange={e => setSelectedPhoneNumberId(e.target.value)}>
  <option value="ALL">All Accounts</option>
  {linkedPhones.map(phone => (
    <option key={phone.phone_number_id} value={phone.phone_number_id}>
      {phone.display_phone_number || phone.phone_number_id}
    </option>
  ))}
</select>
```

#### Chats (Should be same ✅)
```javascript
// App.jsx
const [phoneNumberId, setPhoneNumberId] = useState(null);

// Dropdown
<select value={phoneNumberId || ''} onChange={(e) => setPhoneNumberId(e.target.value || null)}>
  <option value="">All Channels</option>
  {linkedPhones.map(p => (
    <option key={p.phone_number_id} value={p.phone_number_id}>
      {p.display_phone_number || p.phone_number_id}
    </option>
  ))}
</select>
```

**Status**: ✅ Both are similar (different naming but same logic)

---

### 3. FETCHING DATA WITH PHONE FILTER

#### Templates (Working ✅)
```javascript
// TemplatesPage.jsx
const loadTemplates = async () => {
  setError(null);
  try {
    const pid = selectedPhoneNumberId === 'ALL' ? null : selectedPhoneNumberId;
    const res = await getTemplates(pid);  // Pass phone ID
    if (res && res.data) {
      setTemplates(res.data);
    }
  } catch (err) {
    setError(err.message);
  }
};

// api.js
export async function getTemplates(phoneNumberId) {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();
  if (phoneNumberId) params.append('phoneNumberId', phoneNumberId);
  const url = `/api/templates?${params.toString()}`;
  const res = await fetch(url, { headers });
  return res.json();
}
```

#### Chats (Should be same ✅)
```javascript
// App.jsx
const loadInbox = async () => {
  if (!currentUser) return;
  try {
    const res = await getInbox(currentUser.teamIds[0], inboxFilter, phoneNumberId);  // Pass phone ID
    const nextConversations = (res.conversations || []).map(c => {
      const base = c.id === currentId ? { ...c, unreadCount: 0 } : c;
      return base;
    });
    setConversations(nextConversations);
  } catch (err) {
    console.error('Failed to load inbox:', err);
  }
};

// api.js
export async function getInbox(teamId, filter, phoneNumberId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  if (filter) params.append('filter', filter);
  if (phoneNumberId) params.append('phoneNumberId', phoneNumberId);  // Pass phone ID
  const url = `/api/inbox?${params.toString()}`;
  const headers = getAuthHeaders();
  const res = await fetch(url, { headers, cache: 'no-store' });
  return res.json();
}
```

**Status**: ✅ Both are identical

---

### 4. BACKEND ROUTE HANDLING

#### Templates (Working ✅)
```javascript
// backend/src/routes/templates.js
router.get('/', async (req, res, next) => {
  try {
    const teamId = await resolveTeamId(req);
    const { phoneNumberId } = req.query;  // Extract phone ID
    
    let configs = [];
    if (phoneNumberId) {
      const config = await waConfig.getConfigByPhone(phoneNumberId);
      if (config.isCustom || config.phoneNumberId) configs = [config];
    } else {
      configs = await waConfig.getAllConfigs(teamId);  // Get all if not specified
    }

    // Fallback if no custom configs
    if (configs.length === 0) {
      configs = [{
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || WABA_ID,
        token: process.env.WHATSAPP_TOKEN,
        isCustom: false
      }];
    }

    let allMetaTemplates = [];
    for (const config of configs) {
      const wabaId = config.businessAccountId;
      if (!wabaId) continue;

      const resp = await whatsappClient.getTemplates(wabaId, 100, config);
      const metaTemplates = resp.data && resp.data.data ? resp.data.data : [];
      allMetaTemplates.push(...metaTemplates.map(t => ({
        ...t,
        wabaId,
        phoneNumberId: config.phoneNumberId  // Tag with phone
      })));
    }

    res.json({ data: allMetaTemplates });
  } catch (err) {
    return next(err);
  }
});
```

#### Chats (Should be similar ✅)
```javascript
// backend/src/routes/inbox.js
router.get('/', async (req, res, next) => {
  try {
    const teamId = (req.query && req.query.teamId) || (req.user.teamIds && req.user.teamIds[0]) || null;
    const filter = req.query.filter || 'open';
    const phoneNumberId = req.query.phoneNumberId || null;  // Extract phone ID
    console.log(`[InboxRoute] GET /inbox teamId=${teamId} filter=${filter} phoneNumberId=${phoneNumberId}`);
    const list = await svc.listConversations(teamId, req.user.id, req.user.role, filter, phoneNumberId);

    res.status(200).json({ conversations: list });
  } catch (err) {
    return next(err);
  }
});
```

**Status**: ✅ Both extract phone ID from query params

---

### 5. BACKEND SERVICE LOGIC

#### Templates (Working ✅)
```javascript
// backend/src/routes/templates.js
// Iterates through each configured phone/WABA
for (const config of configs) {
  const wabaId = config.businessAccountId;
  if (!wabaId) continue;

  const resp = await whatsappClient.getTemplates(wabaId, 100, config);
  const metaTemplates = resp.data && resp.data.data ? resp.data.data : [];
  
  // Tags each template with its phone number
  allMetaTemplates.push(...metaTemplates.map(t => ({
    ...t,
    wabaId,
    phoneNumberId: config.phoneNumberId
  })));
}
```

#### Chats (Should filter by phone ✅)
```javascript
// backend/src/services/inbox.js
// Phone Number Filter
if (phoneNumberId) {
  params.push(phoneNumberId);
  whereClause += ` AND ch.external_id = $${params.length} `;
  console.log(`[InboxService] Filtering by phone number: ${phoneNumberId}`);
}

// Query
const res = await db.query(`
  SELECT c.id, c.status, c.lead_id, ...
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  JOIN channels ch ON ch.id = c.channel_id
  LEFT JOIN whatsapp_settings ws ON ws.phone_number_id = ch.external_id AND ch.type = 'whatsapp'
  LEFT JOIN conversation_assignments ca ON ca.conversation_id = c.id AND ca.released_at IS NULL
  WHERE 1=1 ${whereClause}
  ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
`, params);
```

**Status**: ✅ Both filter by phone number

---

### 6. DEPENDENCY TRACKING

#### Templates (Working ✅)
```javascript
// TemplatesPage.jsx
useEffect(() => {
  loadTemplates();
}, [selectedPhoneNumberId]);  // Re-fetch when phone changes
```

#### Chats (Should be same ✅)
```javascript
// App.jsx
useEffect(() => {
  loadInbox();
}, [currentUser, inboxFilter, phoneNumberId]);  // Re-fetch when phone changes
```

**Status**: ✅ Both re-fetch when phone changes

---

## Key Differences

| Aspect | Templates | Chats |
|--------|-----------|-------|
| **Data Source** | Meta API (fetched per phone) | Database (filtered by phone) |
| **Filtering** | Iterate through configs | SQL WHERE clause |
| **Phone Param** | `phoneNumberId` | `phoneNumberId` |
| **Default** | "All Accounts" | "All Channels" |
| **State Name** | `selectedPhoneNumberId` | `phoneNumberId` |
| **Re-fetch Trigger** | `selectedPhoneNumberId` change | `phoneNumberId` change |

---

## Data Flow Diagram

### Templates Flow
```
User selects phone
    ↓
setSelectedPhoneNumberId(phoneId)
    ↓
useEffect triggers (dependency: selectedPhoneNumberId)
    ↓
loadTemplates() called
    ↓
getTemplates(phoneId) API call
    ↓
GET /api/templates?phoneNumberId=XXX
    ↓
Backend: waConfig.getConfigByPhone(phoneId)
    ↓
whatsappClient.getTemplates(wabaId, config)
    ↓
Return templates for that phone
    ↓
Frontend: setTemplates(data)
    ↓
UI updates with templates for selected phone
```

### Chats Flow (Should be identical)
```
User selects phone
    ↓
setPhoneNumberId(phoneId)
    ↓
useEffect triggers (dependency: phoneNumberId)
    ↓
loadInbox() called
    ↓
getInbox(teamId, filter, phoneId) API call
    ↓
GET /api/inbox?teamId=XXX&filter=open&phoneNumberId=XXX
    ↓
Backend: listConversations(teamId, userId, role, filter, phoneId)
    ↓
SQL: WHERE ch.external_id = $phoneId
    ↓
Return conversations for that phone
    ↓
Frontend: setConversations(data)
    ↓
UI updates with chats for selected phone
```

---

## Verification Checklist

- [ ] Frontend fetches linked phones from `/api/settings/whatsapp`
- [ ] Frontend shows dropdown with all phones
- [ ] Frontend passes `phoneNumberId` to API when phone selected
- [ ] Backend receives `phoneNumberId` in query params
- [ ] Backend logs show filtering is applied
- [ ] Backend SQL filters by `ch.external_id = $phoneNumberId`
- [ ] Database has correct phone numbers in `channels.external_id`
- [ ] Database has correct phone numbers in `whatsapp_settings.phone_number_id`
- [ ] Chats update when phone is selected
- [ ] "All Channels" shows all chats
- [ ] Each phone shows only its chats

---

## Troubleshooting

If chats aren't filtering like templates do:

1. **Check Frontend**
   - Is `phoneNumberId` being passed to `getInbox()`?
   - Is the API URL correct? `GET /api/inbox?phoneNumberId=XXX`

2. **Check Backend Route**
   - Is `phoneNumberId` being extracted from query params?
   - Is it being passed to `listConversations()`?

3. **Check Backend Service**
   - Is the WHERE clause being added?
   - Is the phone ID matching the channel's external_id?

4. **Check Database**
   - Do channels have the correct external_id?
   - Do whatsapp_settings have the correct phone_number_id?
   - Do they match?

5. **Check Logs**
   - Frontend: `[Inbox] Loading with filter=open, phoneNumberId=XXX`
   - Backend: `[InboxService] Filtering by phone number: XXX`
   - If logs don't appear, the parameter isn't being passed
