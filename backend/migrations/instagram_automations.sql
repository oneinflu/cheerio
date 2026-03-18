-- Instagram Automations table for auto-DM, comment-to-DM, and auto-reply rules
CREATE TABLE IF NOT EXISTS instagram_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('auto_reply', 'comment_dm', 'auto_dm')),
  name VARCHAR(255) NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups by channel and type
CREATE INDEX IF NOT EXISTS idx_instagram_automations_channel_type 
  ON instagram_automations(channel_id, type, is_active);
