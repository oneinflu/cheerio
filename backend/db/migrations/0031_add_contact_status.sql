-- Add lead_status column to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new';

-- Update existing contacts to have 'new' status if null
UPDATE contacts SET lead_status = 'new' WHERE lead_status IS NULL;

-- Index for filtering performance
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status ON contacts(lead_status);
