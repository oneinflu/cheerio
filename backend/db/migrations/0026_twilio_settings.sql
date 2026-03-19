-- 0026_twilio_settings.sql
-- Twilio SMS + Voice integration

CREATE TABLE IF NOT EXISTS twilio_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  account_sid TEXT NOT NULL,
  auth_token TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  messaging_service_sid TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id)
);

CREATE TABLE IF NOT EXISTS twilio_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'sms',
  sid TEXT,
  from_number TEXT,
  to_number TEXT,
  direction TEXT DEFAULT 'outbound',
  status TEXT DEFAULT 'initiated',
  body TEXT,
  duration INTEGER DEFAULT 0,
  recording_url TEXT,
  price TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  initiated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twilio_logs_team_id ON twilio_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_twilio_logs_type ON twilio_logs(team_id, type);
CREATE INDEX IF NOT EXISTS idx_twilio_logs_sid ON twilio_logs(sid);
