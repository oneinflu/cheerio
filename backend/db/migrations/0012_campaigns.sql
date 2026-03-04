
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'whatsapp',  -- 'whatsapp' | 'email' | 'sms'
  label_id UUID REFERENCES contact_labels(id) ON DELETE SET NULL,
  template_name TEXT,
  template_language TEXT DEFAULT 'en_US',
  template_components JSONB DEFAULT '[]'::jsonb,   -- full components array for sending
  variable_mapping JSONB DEFAULT '{}'::jsonb,       -- { "1": "display_name", "2": "external_id" }
  status TEXT NOT NULL DEFAULT 'draft',             -- 'draft' | 'scheduled' | 'running' | 'completed' | 'stopped'
  scheduled_at TIMESTAMPTZ,                         -- null = send immediately
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_contacts INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'sent' | 'failed'
  wa_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
