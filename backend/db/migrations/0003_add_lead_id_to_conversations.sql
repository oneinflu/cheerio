ALTER TABLE conversations ADD COLUMN lead_id TEXT;
COMMENT ON COLUMN conversations.lead_id IS 'External Lead ID from CRM';
