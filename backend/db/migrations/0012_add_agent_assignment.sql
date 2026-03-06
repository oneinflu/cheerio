BEGIN;

-- 1. Add attributes column to users for storing skills/metadata (course, language, etc.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_users_attributes_gin ON users USING GIN (attributes);

-- 2. Update automation_rules constraint to allow 'assign_agent'
-- Since we can't easily alter a CHECK constraint in one line, we drop and recreate it.
ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_action_type_check;
ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_action_type_check 
  CHECK (action_type IN ('send_message', 'start_workflow', 'assign_agent', 'notify_admin'));

COMMIT;
