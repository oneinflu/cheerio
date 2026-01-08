BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE channel_type AS ENUM ('whatsapp', 'instagram');
CREATE TYPE role_type AS ENUM ('admin', 'agent', 'supervisor');
CREATE TYPE conversation_status AS ENUM ('open', 'snoozed', 'closed');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_content_type AS ENUM ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact');
CREATE TYPE delivery_status AS ENUM ('queued', 'sending', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE media_kind AS ENUM ('image', 'video', 'audio', 'document', 'sticker');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role role_type NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE users IS 'Application users (agents, admins, supervisors) with role-based access';

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE teams IS 'Teams for organizing agents and scoping conversations';

CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);
COMMENT ON TABLE team_members IS 'Membership linking users to teams';

CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type channel_type NOT NULL,
  name TEXT NOT NULL,
  external_id TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, external_id)
);
COMMENT ON TABLE channels IS 'External messaging channels (WhatsApp Cloud API, Instagram) configuration and identity';

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  display_name TEXT,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, external_id)
);
COMMENT ON TABLE contacts IS 'End-user contacts per channel with external identifiers and profile info';

CREATE TRIGGER contacts_set_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status conversation_status NOT NULL DEFAULT 'open',
  external_thread_id TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('open','snoozed','closed'))
);
COMMENT ON TABLE conversations IS 'Conversation threads per contact/channel with lifecycle status and last activity';

CREATE UNIQUE INDEX ux_conversations_channel_thread
ON conversations (channel_id, external_thread_id)
WHERE external_thread_id IS NOT NULL;

CREATE TRIGGER conversations_set_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE conversation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  assignee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);
COMMENT ON TABLE conversation_assignments IS 'Assignment history ensuring only one active assignee per conversation at a time';

CREATE UNIQUE INDEX ux_conversation_assignments_active
ON conversation_assignments (conversation_id)
WHERE released_at IS NULL;

CREATE INDEX idx_assignments_active_team
ON conversation_assignments (team_id)
WHERE released_at IS NULL;

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  content_type message_content_type NOT NULL,
  external_message_id TEXT,
  text_body TEXT,
  delivery_status delivery_status,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  UNIQUE (channel_id, external_message_id)
);
COMMENT ON TABLE messages IS 'Inbound/outbound messages per conversation with delivery and read tracking';

CREATE INDEX idx_messages_conv_created_at
ON messages (conversation_id, created_at DESC);

CREATE INDEX idx_messages_inbound_unread
ON messages (conversation_id)
WHERE direction = 'inbound' AND read_at IS NULL;

CREATE INDEX idx_messages_raw_payload_gin
ON messages USING GIN (raw_payload);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  kind media_kind NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE attachments IS 'Media attachments for messages (image, video, audio, document, sticker)';

CREATE INDEX idx_attachments_message_id
ON attachments (message_id);

CREATE TABLE staff_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE staff_notes IS 'Internal notes by staff on conversations, not sent to external users';

CREATE INDEX idx_staff_notes_conv_created_at
ON staff_notes (conversation_id, created_at DESC);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE audit_logs IS 'Auditable events for configuration changes, assignments, sends, and policy-sensitive actions';

CREATE INDEX idx_audit_entity_recent
ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX idx_audit_action_recent
ON audit_logs (action, created_at DESC);

CREATE INDEX idx_audit_metadata_gin
ON audit_logs USING GIN (metadata);

CREATE INDEX idx_conversations_status_last_msg
ON conversations (status, last_message_at DESC);

CREATE INDEX idx_contacts_channel_id
ON contacts (channel_id);

CREATE INDEX idx_team_members_user_id
ON team_members (user_id);

COMMIT;

