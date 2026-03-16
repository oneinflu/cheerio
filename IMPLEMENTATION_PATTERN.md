# Implementation Pattern - How Chat Filtering Should Work

## The Pattern

Chat filtering by phone number follows this exact pattern:

```
FRONTEND                          BACKEND                         DATABASE
=========                         =======                         ========

1. Fetch Settings
   GET /api/settings/whatsapp
                                  SELECT * FROM whatsapp_settings
                                  WHERE team_id = $1
                                                                   whatsapp_settings
                                                                   ├─ phone_number_id
                                                                   ├─ display_phone_number
                                                                   └─ is_active

2. Store in State
   setLinkedPhones(data.allSettings)
   
3. Render Dropdown
   <select>
     <option value="">All Channels</option>
     {linkedPhones.map(p => (
       <option value={p.phone_number_id}>
         {p.display_phone_number}
       </option>
     ))}
   </select>

4. User Selects Phone
   setPhoneNumberId(phoneId)

5. Fetch Chats
   GET /api/inbox?phoneNumberId=921055841100882
                                  
                                  Extract: phoneNumberId from query
                                  
                                  Call: listConversations(..., phoneNumberId)
                                  
                                  Build WHERE clause:
                                  if (phoneNumberId) {
                                    WHERE ch.external_id = $phoneNumberId
                                  }
                                  
                                  Query:
                                  SELECT c.* FROM conversations c
                                  JOIN channels ch ON ch.id = c.channel_id
                                  WHERE ch.external_id = $1
                                                                   conversations
                                                                   ├─ channel_id
                                                                   └─ ...
                                                                   
                                                                   channels
                                                                   ├─ id
                                                                   ├─ external_id (phone_number_id)
                                                                   └─ type = 'whatsapp'

6. Return Results
   res.json({ conversations: [...] })
   
7. Display Chats
   setConversations(data.conversations)
   
   Render conversations for selected phone
```

## Code Implementation

### Frontend Pattern

```javascript
// 1. State
const [linkedPhones, setLinkedPhones] = useState([]);
const [phoneNumberId, setPhoneNumberId] = useState(null);
const [conversations, setConversations] = useState([]);

// 2. Fetch linked phones
useEffect(() => {
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/whatsapp');
      if (res.ok) {
        const data = await res.json();
        setLinkedPhones(data.allSettings || []);
      }
    } catch (e) {
      console.error("Failed to fetch linked phones", e);
    }
  };
  fetchSettings();
}, []);

// 3. Fetch chats when phone changes
useEffect(() => {
  loadInbox();
}, [phoneNumberId]);  // Re-fetch when phone changes

// 4. Load inbox with phone filter
const loadInbox = async () => {
  try {
    const res = await getInbox(teamId, filter, phoneNumberId);
    setConversations(res.conversations || []);
  } catch (err) {
    console.error('Failed to load inbox:', err);
  }
};

// 5. Render dropdown
<select 
  value={phoneNumberId || ''} 
  onChange={(e) => setPhoneNumberId(e.target.value || null)}
>
  <option value="">All Channels</option>
  {linkedPhones.map(p => (
    <option key={p.phone_number_id} value={p.phone_number_id}>
      {p.display_phone_number || p.phone_number_id}
    </option>
  ))}
</select>

// 6. Render conversations
{conversations.map(conv => (
  <ConversationItem key={conv.id} conversation={conv} />
))}
```

### Backend Pattern

```javascript
// 1. Route handler
router.get('/', async (req, res, next) => {
  try {
    const teamId = req.query.teamId || req.user.teamIds[0];
    const filter = req.query.filter || 'open';
    const phoneNumberId = req.query.phoneNumberId || null;  // Extract phone ID
    
    console.log(`[InboxRoute] GET /inbox phoneNumberId=${phoneNumberId}`);
    
    const list = await svc.listConversations(
      teamId, 
      req.user.id, 
      req.user.role, 
      filter, 
      phoneNumberId  // Pass to service
    );

    res.status(200).json({ conversations: list });
  } catch (err) {
    return next(err);
  }
});

// 2. Service function
async function listConversations(teamId, userId, userRole, filter, phoneNumberId) {
  const params = [];
  let whereClause = "";

  // Phone Number Filter
  if (phoneNumberId) {
    params.push(phoneNumberId);
    whereClause += ` AND ch.external_id = $${params.length} `;
    console.log(`[InboxService] Filtering by phone number: ${phoneNumberId}`);
  }

  // Build and execute query
  const res = await db.query(`
    SELECT c.id, c.status, c.created_at, ...
    FROM conversations c
    JOIN channels ch ON ch.id = c.channel_id
    JOIN contacts ct ON ct.id = c.contact_id
    WHERE 1=1 ${whereClause}
    ORDER BY c.last_message_at DESC
  `, params);

  return res.rows;
}
```

### API Pattern

```javascript
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

## Data Flow Example

### Scenario: User has 2 phones and selects Phone #1

```
1. Page loads
   Frontend: GET /api/settings/whatsapp
   Backend: SELECT * FROM whatsapp_settings WHERE team_id = 'team-1'
   Result: [
     { phone_number_id: '921055841100882', display_phone_number: '+91 205 584 1100882' },
     { phone_number_id: '919876543210', display_phone_number: '+91 987 654 3210' }
   ]
   Frontend: setLinkedPhones([...])
   UI: Dropdown shows both phones

2. User selects Phone #1
   Frontend: setPhoneNumberId('921055841100882')
   
3. useEffect triggers
   Frontend: GET /api/inbox?teamId=team-1&filter=open&phoneNumberId=921055841100882
   
4. Backend processes request
   Backend: Extract phoneNumberId = '921055841100882'
   Backend: Build WHERE clause: AND ch.external_id = '921055841100882'
   
5. Database query
   Database: SELECT conversations WHERE channels.external_id = '921055841100882'
   Result: [
     { id: 'conv-1', contact: 'John', messages: 5 },
     { id: 'conv-2', contact: 'Jane', messages: 3 }
   ]
   
6. Frontend receives results
   Frontend: setConversations([...])
   UI: Shows only conversations from Phone #1

7. User selects Phone #2
   Frontend: setPhoneNumberId('919876543210')
   
8. useEffect triggers again
   Frontend: GET /api/inbox?teamId=team-1&filter=open&phoneNumberId=919876543210
   
9. Backend processes request
   Backend: Extract phoneNumberId = '919876543210'
   Backend: Build WHERE clause: AND ch.external_id = '919876543210'
   
10. Database query
    Database: SELECT conversations WHERE channels.external_id = '919876543210'
    Result: [
      { id: 'conv-3', contact: 'Bob', messages: 2 }
    ]
    
11. Frontend receives results
    Frontend: setConversations([...])
    UI: Shows only conversations from Phone #2

12. User selects "All Channels"
    Frontend: setPhoneNumberId(null)
    
13. useEffect triggers again
    Frontend: GET /api/inbox?teamId=team-1&filter=open
    (Note: phoneNumberId is NOT in URL)
    
14. Backend processes request
    Backend: Extract phoneNumberId = null
    Backend: No phone filter added to WHERE clause
    
15. Database query
    Database: SELECT conversations (no phone filter)
    Result: [
      { id: 'conv-1', contact: 'John', messages: 5 },
      { id: 'conv-2', contact: 'Jane', messages: 3 },
      { id: 'conv-3', contact: 'Bob', messages: 2 }
    ]
    
16. Frontend receives results
    Frontend: setConversations([...])
    UI: Shows all conversations from all phones
```

## Key Points

### 1. Phone Number ID Must Match
```
whatsapp_settings.phone_number_id = channels.external_id

Example:
whatsapp_settings: phone_number_id = '921055841100882'
channels: external_id = '921055841100882'
✓ MATCH - filtering works

channels: external_id = '91-205-584-1100882'
✗ MISMATCH - filtering fails
```

### 2. Phone ID Must Be Passed Through All Layers
```
Frontend → API → Route → Service → Database
   ↓         ↓      ↓       ↓         ↓
 null/id   null/id null/id null/id  null/id

If any layer drops it, filtering fails
```

### 3. Dependency Array Must Include Phone ID
```javascript
// ✓ CORRECT - Re-fetches when phone changes
useEffect(() => {
  loadInbox();
}, [phoneNumberId]);

// ✗ WRONG - Never re-fetches when phone changes
useEffect(() => {
  loadInbox();
}, []);
```

### 4. WHERE Clause Must Be Conditional
```sql
-- ✓ CORRECT - Only adds filter if phone ID provided
WHERE 1=1 
  AND (phoneNumberId IS NULL OR ch.external_id = $phoneNumberId)

-- ✗ WRONG - Always filters, even when null
WHERE ch.external_id = $phoneNumberId
```

## Testing the Pattern

### Test 1: Verify Phone Numbers Match
```sql
SELECT ch.external_id, ws.phone_number_id
FROM channels ch
LEFT JOIN whatsapp_settings ws ON ws.phone_number_id = ch.external_id
WHERE ch.type = 'whatsapp';
```

### Test 2: Verify Phone ID is Passed
```javascript
// In browser console
console.log(phoneNumberId);  // Should show selected phone ID
```

### Test 3: Verify Backend Receives It
```
Server logs should show:
[InboxRoute] GET /inbox phoneNumberId=921055841100882
[InboxService] Filtering by phone number: 921055841100882
```

### Test 4: Verify Query Works
```sql
SELECT COUNT(*) FROM conversations c
JOIN channels ch ON ch.id = c.channel_id
WHERE ch.external_id = '921055841100882';
```

## Common Mistakes

### Mistake 1: Phone ID Not Passed to Backend
```javascript
// ✗ WRONG
const res = await getInbox(teamId, filter);  // Missing phoneNumberId

// ✓ CORRECT
const res = await getInbox(teamId, filter, phoneNumberId);
```

### Mistake 2: Phone ID Not Extracted from Query
```javascript
// ✗ WRONG
const phoneNumberId = req.body.phoneNumberId;  // Wrong location

// ✓ CORRECT
const phoneNumberId = req.query.phoneNumberId;
```

### Mistake 3: WHERE Clause Not Added
```javascript
// ✗ WRONG
if (phoneNumberId) {
  // Forgot to add to WHERE clause
}

// ✓ CORRECT
if (phoneNumberId) {
  params.push(phoneNumberId);
  whereClause += ` AND ch.external_id = $${params.length} `;
}
```

### Mistake 4: Phone ID Not in Dependency Array
```javascript
// ✗ WRONG
useEffect(() => {
  loadInbox();
}, []);  // Missing phoneNumberId

// ✓ CORRECT
useEffect(() => {
  loadInbox();
}, [phoneNumberId]);
```

### Mistake 5: Phone Numbers Don't Match
```
// ✗ WRONG
whatsapp_settings: '921055841100882'
channels: '91-205-584-1100882'
Result: No conversations found

// ✓ CORRECT
whatsapp_settings: '921055841100882'
channels: '921055841100882'
Result: Conversations found
```

## Summary

The pattern is simple:
1. Fetch all linked phones
2. User selects a phone
3. Pass phone ID to backend
4. Backend filters by phone ID
5. Return only chats from that phone
6. Display filtered chats

If any step is missing or wrong, filtering fails.

Use this pattern as a reference when implementing or debugging chat filtering.
