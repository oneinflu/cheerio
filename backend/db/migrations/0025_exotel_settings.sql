-- 0025_exotel_settings.sql
-- Exotel cloud telephony integration

CREATE TABLE IF NOT EXISTS exotel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  sid TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_token TEXT NOT NULL,
  subdomain TEXT NOT NULL DEFAULT 'api.in.exotel.com',
  caller_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id)
);

CREATE TABLE IF NOT EXISTS exotel_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL,
  call_sid TEXT,
  from_number TEXT,
  to_number TEXT,
  direction TEXT DEFAULT 'outbound',
  status TEXT DEFAULT 'initiated',
  duration INTEGER DEFAULT 0,
  recording_url TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  initiated_by TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exotel_call_logs_team_id ON exotel_call_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_exotel_call_logs_call_sid ON exotel_call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_exotel_call_logs_contact_id ON exotel_call_logs(contact_id);
