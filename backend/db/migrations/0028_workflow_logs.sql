-- 0028_workflow_logs.sql
-- Stores execution history of workflows for reporting.

CREATE TABLE IF NOT EXISTS workflow_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  phone_number    VARCHAR(50) NOT NULL,
  status          VARCHAR(20) NOT NULL, -- 'success', 'failed', 'running'
  execution_log   JSONB NOT NULL DEFAULT '[]',
  context_preview JSONB NOT NULL DEFAULT '{}',
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_wf_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_phone ON workflow_runs(phone_number);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(started_at DESC);
