-- Add is_independent to lead_stage_workflows to allow workflows to be organized in stages without automatic sequence triggering
ALTER TABLE lead_stage_workflows ADD COLUMN IF NOT EXISTS is_independent BOOLEAN DEFAULT false;
