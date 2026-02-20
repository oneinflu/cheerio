BEGIN;

CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('message_text', 'course_equals')),
  match_value TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('send_message', 'start_workflow')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE automation_rules IS 'Simple rules engine for message/course based automations';

CREATE TRIGGER automation_rules_set_updated_at
BEFORE UPDATE ON automation_rules
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

