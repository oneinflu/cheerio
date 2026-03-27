-- 0036_workflow_scheduled_tasks.sql
-- Persistent queue for workflow execution

CREATE TABLE IF NOT EXISTS workflow_scheduled_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  contact_phone   VARCHAR(50) NOT NULL,
  stage_id        UUID REFERENCES lead_stages(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'executing', 'completed', 'failed', 'cancelled'
  scheduled_time  TIMESTAMPTZ NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  sequence_order  INTEGER DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_workflow_task 
ON workflow_scheduled_tasks (workflow_id, contact_phone, stage_id, sequence_order) 
WHERE (status = 'pending');

CREATE INDEX IF NOT EXISTS idx_workflow_scheduled_pending ON workflow_scheduled_tasks(status, scheduled_time) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_workflow_scheduled_phone ON workflow_scheduled_tasks(contact_phone);
CREATE INDEX IF NOT EXISTS idx_workflow_scheduled_stage ON workflow_scheduled_tasks(stage_id);
