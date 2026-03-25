-- Backfill contact lead columns from profile JSONB
UPDATE contacts 
SET 
  lead_stage = profile->>'leadStage',
  course = profile->>'course',
  assigned_to = profile->>'assignedTo',
  email = profile->>'email',
  lead_id = profile->>'leadId',
  last_sync_at = CASE 
    WHEN (profile->>'syncedAt') IS NOT NULL 
    THEN (profile->>'syncedAt')::timestamp with time zone 
    ELSE NULL 
  END
WHERE 
  lead_stage IS NULL AND (profile->>'leadStage') IS NOT NULL;
