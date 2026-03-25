-- Add target_time to lead_stage_workflows to allow workflows to trigger at specific times of day (e.g. 9:00 AM)
ALTER TABLE lead_stage_workflows ADD COLUMN IF NOT EXISTS target_time TEXT;
