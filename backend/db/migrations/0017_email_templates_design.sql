DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='email_templates' AND column_name='design'
  ) THEN
    ALTER TABLE email_templates
    ADD COLUMN design JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;
