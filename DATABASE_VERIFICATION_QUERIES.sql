-- Database Verification Queries for Chat Filtering by Phone Number
-- Run these queries to diagnose the issue

-- ============================================================================
-- 1. CHECK WHATSAPP SETTINGS (What phones are configured)
-- ============================================================================

-- Show all configured phone numbers
SELECT 
  team_id,
  phone_number_id,
  business_account_id,
  display_phone_number,
  is_active,
  created_at,
  updated_at
FROM whatsapp_settings
ORDER BY created_at DESC;

-- Count how many phones per team
SELECT 
  team_id,
  COUNT(*) as phone_count,
  STRING_AGG(display_phone_number, ', ') as phones
FROM whatsapp_settings
WHERE is_active = true
GROUP BY team_id;

-- ============================================================================
-- 2. CHECK CHANNELS (Where incoming messages are stored)
-- ============================================================================

-- Show all WhatsApp channels
SELECT 
  id,
  type,
  external_id,
  name,
  active,
  created_at
FROM channels
WHERE type = 'whatsapp'
ORDER BY created_at DESC;

-- Count conversations per channel
SELECT 
  ch.external_id as phone_number_id,
  ch.name,
  COUNT(DISTINCT c.id) as conversation_count,
  COUNT(DISTINCT m.id) as message_count,
  MAX(c.created_at) as latest_conversation
FROM channels ch
LEFT JOIN conversations c ON c.channel_id = ch.id
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE ch.type = 'whatsapp'
GROUP BY ch.id, ch.external_id, ch.name
ORDER BY conversation_count DESC;

-- ============================================================================
-- 3. VERIFY PHONE NUMBER MATCHING
-- ============================================================================

-- Check if phone numbers in channels match settings
SELECT 
  DISTINCT ch.external_id as channel_phone,
  CASE 
    WHEN ws.phone_number_id IS NOT NULL THEN 'MATCHED'
    ELSE 'NOT IN SETTINGS'
  END as status,
  ws.phone_number_id as settings_phone,
  ws.display_phone_number
FROM channels ch
LEFT JOIN whatsapp_settings ws ON ws.phone_number_id = ch.external_id
WHERE ch.type = 'whatsapp'
ORDER BY ch.external_id;

-- Find phone numbers in settings but not in channels
SELECT 
  phone_number_id,
  display_phone_number,
  'NO CONVERSATIONS YET' as status
FROM whatsapp_settings
WHERE phone_number_id NOT IN (
  SELECT DISTINCT external_id FROM channels WHERE type = 'whatsapp'
)
ORDER BY phone_number_id;

-- ============================================================================
-- 4. TEST FILTERING QUERIES
-- ============================================================================

-- Test: Get conversations for a specific phone number
-- Replace '921055841100882' with your actual phone number
SELECT 
  c.id,
  c.status,
  ct.display_name,
  ct.external_id as contact_wa_id,
  ch.external_id as phone_number_id,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at
FROM conversations c
JOIN channels ch ON ch.id = c.channel_id
JOIN contacts ct ON ct.id = c.contact_id
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE ch.external_id = '921055841100882'  -- CHANGE THIS
GROUP BY c.id, ct.display_name, ct.external_id, ch.external_id
ORDER BY MAX(m.created_at) DESC NULLS LAST;

-- Test: Get all conversations (no filter)
SELECT 
  c.id,
  c.status,
  ct.display_name,
  ch.external_id as phone_number_id,
  COUNT(m.id) as message_count
FROM conversations c
JOIN channels ch ON ch.id = c.channel_id
JOIN contacts ct ON ct.id = c.contact_id
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id, ct.display_name, ch.external_id
ORDER BY COUNT(m.id) DESC;

-- ============================================================================
-- 5. CHECK CONVERSATION ASSIGNMENTS (For team filtering)
-- ============================================================================

-- Show conversation assignments
SELECT 
  ca.conversation_id,
  ca.team_id,
  ca.assignee_user_id,
  ca.claimed_at,
  ca.released_at,
  c.status,
  ch.external_id as phone_number_id
FROM conversation_assignments ca
JOIN conversations c ON c.id = ca.conversation_id
JOIN channels ch ON ch.id = c.channel_id
WHERE ca.released_at IS NULL
ORDER BY ca.claimed_at DESC
LIMIT 20;

-- ============================================================================
-- 6. DETAILED CONVERSATION VIEW
-- ============================================================================

-- Get detailed view of conversations with all related info
SELECT 
  c.id as conversation_id,
  c.status,
  c.created_at,
  c.last_message_at,
  ch.external_id as phone_number_id,
  ch.name as channel_name,
  ct.display_name as contact_name,
  ct.external_id as contact_wa_id,
  ws.display_phone_number,
  ws.team_id,
  ca.assignee_user_id,
  ca.team_id as assignment_team_id,
  COUNT(m.id) as message_count,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND direction = 'inbound' AND read_at IS NULL) as unread_count
FROM conversations c
JOIN channels ch ON ch.id = c.channel_id
JOIN contacts ct ON ct.id = c.contact_id
LEFT JOIN whatsapp_settings ws ON ws.phone_number_id = ch.external_id
LEFT JOIN conversation_assignments ca ON ca.conversation_id = c.id AND ca.released_at IS NULL
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id, ch.id, ct.id, ws.id, ca.id
ORDER BY c.last_message_at DESC NULLS LAST
LIMIT 50;

-- ============================================================================
-- 7. CHECK FOR DATA ISSUES
-- ============================================================================

-- Find conversations without a channel
SELECT c.id, c.status, c.created_at
FROM conversations c
WHERE c.channel_id IS NULL;

-- Find conversations without a contact
SELECT c.id, c.status, c.created_at
FROM conversations c
WHERE c.contact_id IS NULL;

-- Find channels without a type
SELECT id, external_id, name
FROM channels
WHERE type IS NULL OR type = '';

-- Find messages without a conversation
SELECT id, external_message_id, created_at
FROM messages
WHERE conversation_id IS NULL;

-- ============================================================================
-- 8. PERFORMANCE CHECK
-- ============================================================================

-- Check index on channels.external_id (should be fast)
EXPLAIN ANALYZE
SELECT COUNT(*) FROM conversations c
JOIN channels ch ON ch.id = c.channel_id
WHERE ch.external_id = '921055841100882';

-- Check index on whatsapp_settings.phone_number_id
EXPLAIN ANALYZE
SELECT * FROM whatsapp_settings
WHERE phone_number_id = '921055841100882';

-- ============================================================================
-- 9. SAMPLE DATA FOR TESTING
-- ============================================================================

-- Get a sample phone number to test with
SELECT DISTINCT external_id
FROM channels
WHERE type = 'whatsapp'
LIMIT 1;

-- Get sample conversations for that phone
SELECT c.id, ct.display_name, COUNT(m.id) as msg_count
FROM conversations c
JOIN channels ch ON ch.id = c.channel_id
JOIN contacts ct ON ct.id = c.contact_id
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE ch.external_id = (SELECT DISTINCT external_id FROM channels WHERE type = 'whatsapp' LIMIT 1)
GROUP BY c.id, ct.display_name
LIMIT 5;

-- ============================================================================
-- 10. QUICK SUMMARY
-- ============================================================================

-- Summary of the system state
SELECT 
  'Total Phones Configured' as metric,
  COUNT(*)::text as value
FROM whatsapp_settings
WHERE is_active = true

UNION ALL

SELECT 
  'Total WhatsApp Channels',
  COUNT(*)::text
FROM channels
WHERE type = 'whatsapp'

UNION ALL

SELECT 
  'Total Conversations',
  COUNT(*)::text
FROM conversations

UNION ALL

SELECT 
  'Total Messages',
  COUNT(*)::text
FROM messages

UNION ALL

SELECT 
  'Conversations with Assignments',
  COUNT(*)::text
FROM conversation_assignments
WHERE released_at IS NULL

UNION ALL

SELECT 
  'Unread Messages',
  COUNT(*)::text
FROM messages
WHERE direction = 'inbound' AND read_at IS NULL;

-- ============================================================================
-- NOTES FOR DEBUGGING
-- ============================================================================

-- If you see mismatches:
-- 1. Phone in channels.external_id but NOT in whatsapp_settings.phone_number_id
--    → New phone received messages but wasn't added to settings
--    → Solution: Add to whatsapp_settings or update channels.external_id
--
-- 2. Phone in whatsapp_settings but NO conversations
--    → Phone is configured but hasn't received messages yet
--    → Solution: Send a test message to that phone
--
-- 3. Conversations exist but filtering doesn't work
--    → Check if phone_number_id values match exactly (no formatting differences)
--    → Check if team_id filtering is interfering
--    → Check if conversation_assignments are blocking visibility
--
-- 4. All conversations show regardless of filter
--    → Backend might not be applying the WHERE clause
--    → Check server logs for filtering messages
--    → Verify the phone_number_id parameter is being passed
