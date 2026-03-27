-- Migration 0037: Fix missing columns for Leads and Templates
BEGIN;

-- 1. Add course_group to template_settings
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='template_settings' AND column_name='course_group') THEN
        ALTER TABLE template_settings ADD COLUMN course_group TEXT;
    END IF;
END $$;

-- 2. Add lead_stage_id to contacts
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='lead_stage_id') THEN
        ALTER TABLE contacts ADD COLUMN lead_stage_id UUID REFERENCES lead_stages(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Backfill lead_stage_id from lead_stage (name)
UPDATE contacts c
SET lead_stage_id = s.id
FROM lead_stages s
WHERE (c.lead_stage = s.name OR c.lead_stage_id IS NULL)
  AND (c.lead_stage_id IS NULL AND c.lead_stage IS NOT NULL);

COMMIT;
