BEGIN;

ALTER TABLE conversations
ADD COLUMN lead_stage_id UUID REFERENCES lead_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_lead_stage_id
ON conversations (lead_stage_id);

COMMIT;

