-- Migration: Remove Foreign Key constraints for User IDs
-- Rationale: Users are managed externally. We store their IDs but do not enforce existence in local users table.

ALTER TABLE conversation_assignments DROP CONSTRAINT IF EXISTS conversation_assignments_assignee_user_id_fkey;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;
