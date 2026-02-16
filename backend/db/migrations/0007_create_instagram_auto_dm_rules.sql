BEGIN;

CREATE TABLE IF NOT EXISTS instagram_auto_dm_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('story_reply', 'post_comment')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('any', 'keyword')),
  keywords TEXT,
  message_template TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, scope)
);

COMMIT;

