-- Clean up existing data to avoid conflicts
TRUNCATE conversation_assignments, staff_notes, messages, conversations, contacts, team_members, users, teams, channels CASCADE;

-- Insert Channel
INSERT INTO channels (id, type, name, external_id, config, created_at)
VALUES 
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'whatsapp', 'Demo WhatsApp', '+15559999999', '{}', NOW());

-- Insert Team
INSERT INTO teams (id, name, created_at)
VALUES 
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Support Team', NOW());

-- Insert User (Agent)
INSERT INTO users (id, name, email, role, created_at)
VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'John Agent', 'agent@demo.com', 'agent', NOW()),
('a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Jane Supervisor', 'supervisor@demo.com', 'supervisor', NOW()),
('a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Mike Agent', 'mike@demo.com', 'agent', NOW());

-- Insert Team Member
INSERT INTO team_members (team_id, user_id, joined_at)
VALUES 
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NOW()),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', NOW()),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', NOW());

-- Insert Contacts
INSERT INTO contacts (id, channel_id, external_id, display_name, created_at, updated_at)
VALUES 
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '+15550101', 'Alice Customer', NOW(), NOW()),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '+15550102', 'Bob Client', NOW(), NOW()),
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f66', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '+15550103', 'Charlie Lead', NOW(), NOW());

-- Insert Conversations
-- 1. Alice (Open, Unassigned)
INSERT INTO conversations (id, channel_id, contact_id, status, last_message_at, created_at, updated_at)
VALUES 
('11111111-1111-1111-1111-111111111111', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44', 'open', NOW(), NOW(), NOW());

-- 2. Bob (Closed)
INSERT INTO conversations (id, channel_id, contact_id, status, last_message_at, created_at, updated_at)
VALUES 
('22222222-2222-2222-2222-222222222222', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55', 'closed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day');

-- 3. Charlie (Open, Assigned to John Agent)
INSERT INTO conversations (id, channel_id, contact_id, status, last_message_at, created_at, updated_at)
VALUES 
('33333333-3333-3333-3333-333333333333', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f66', 'open', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes');

INSERT INTO conversation_assignments (conversation_id, team_id, assignee_user_id, claimed_at)
VALUES 
('33333333-3333-3333-3333-333333333333', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NOW() - INTERVAL '45 minutes');


-- Insert Messages for Alice (Conversation 1)
INSERT INTO messages (id, conversation_id, channel_id, direction, content_type, text_body, delivery_status, created_at)
VALUES 
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'inbound', 'text', 'Hi, I have an issue with my order #1234.', NULL, NOW() - INTERVAL '10 minutes'),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'outbound', 'text', 'Hello Alice! I can certainly help you with that. Could you please confirm your email address?', 'read', NOW() - INTERVAL '5 minutes'),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'inbound', 'text', 'It is alice@example.com', NULL, NOW() - INTERVAL '1 minute');

-- Insert Messages for Charlie (Conversation 3)
INSERT INTO messages (id, conversation_id, channel_id, direction, content_type, text_body, delivery_status, created_at)
VALUES 
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'inbound', 'text', 'Is this item in stock?', NULL, NOW() - INTERVAL '1 hour'),
(gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'outbound', 'text', 'Yes, we have plenty in stock.', 'sent', NOW() - INTERVAL '30 minutes');

-- Insert Notes for Alice (Conversation 1)
INSERT INTO staff_notes (id, conversation_id, author_user_id, body, created_at)
VALUES 
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Customer is asking about Order #1234. Priority support.', NOW() - INTERVAL '2 minutes');
