BEGIN;

CREATE TABLE IF NOT EXISTS lead_stage_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES lead_stages(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stage_id, workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_stage_workflows_stage_pos
ON lead_stage_workflows (stage_id, position);

CREATE TRIGGER lead_stage_workflows_set_updated_at
BEFORE UPDATE ON lead_stage_workflows
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

