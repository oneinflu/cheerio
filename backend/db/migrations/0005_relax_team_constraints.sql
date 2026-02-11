-- Migration: Relax Team ID constraints
-- Rationale: External leads/assignments might not have a team ID or might refer to an external team not in local DB.

-- 1. Drop Foreign Key constraint for team_id
ALTER TABLE conversation_assignments DROP CONSTRAINT IF EXISTS conversation_assignments_team_id_fkey;

-- 2. Make team_id nullable
ALTER TABLE conversation_assignments ALTER COLUMN team_id DROP NOT NULL;
