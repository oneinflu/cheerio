-- Add lead tracking columns to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_stage TEXT DEFAULT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS course TEXT DEFAULT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_id TEXT DEFAULT NULL;

-- Index for filtering performance
CREATE INDEX IF NOT EXISTS idx_contacts_lead_stage ON contacts(lead_stage);
CREATE INDEX IF NOT EXISTS idx_contacts_course ON contacts(course);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);
