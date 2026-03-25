-- Add delay_minutes to lead_stage_workflows to support sequential automation with delays
ALTER TABLE lead_stage_workflows ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 0;
