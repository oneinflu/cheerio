-- 0014_fix_webhook_events.sql
-- Relax webhook_events.workflow_id from UUID+FK to plain TEXT
-- so any string ID (or future non-UUID id) can be stored.

-- 1. Drop the existing FK constraint first
DO $$
DECLARE
  c TEXT;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'webhook_events'::regclass
    AND contype = 'f';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE webhook_events DROP CONSTRAINT %I', c);
  END IF;
END
$$;

-- 2. Change column type from uuid to text
ALTER TABLE webhook_events
  ALTER COLUMN workflow_id TYPE TEXT USING workflow_id::TEXT;
