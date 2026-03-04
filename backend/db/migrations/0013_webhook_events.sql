-- 0013_webhook_events.sql
-- Stores each incoming hit on a workflow webhook trigger.

CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id  UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  payload      JSONB NOT NULL DEFAULT '{}',
  headers      JSONB NOT NULL DEFAULT '{}',
  source_ip    TEXT,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_events_workflow_idx ON webhook_events (workflow_id, received_at DESC);
