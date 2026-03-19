-- 0027_email_settings.sql
-- Business Email (IMAP/SMTP) integration

CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  display_name TEXT,
  email_address TEXT NOT NULL,
  -- SMTP (outbound)
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER DEFAULT 587,
  smtp_secure BOOLEAN DEFAULT FALSE,
  smtp_user TEXT NOT NULL,
  smtp_pass TEXT NOT NULL,
  -- IMAP (inbound)
  imap_host TEXT NOT NULL,
  imap_port INTEGER DEFAULT 993,
  imap_secure BOOLEAN DEFAULT TRUE,
  imap_user TEXT,
  imap_pass TEXT,
  -- State
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id)
);

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL,
  message_id TEXT,
  in_reply_to TEXT,
  thread_id TEXT,
  direction TEXT DEFAULT 'inbound',
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  to_address TEXT,
  to_name TEXT,
  cc TEXT,
  body_text TEXT,
  body_html TEXT,
  status TEXT DEFAULT 'received',
  is_read BOOLEAN DEFAULT FALSE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  sent_by TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_team_id ON email_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_contact ON email_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages(team_id, direction);
