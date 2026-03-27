-- Migration 0038: Update workflows schema to support nodes/edges/trigger and team_id
BEGIN;

-- Add team_id if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflows' AND column_name='team_id') THEN
        ALTER TABLE workflows ADD COLUMN team_id TEXT REFERENCES teams(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add trigger if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflows' AND column_name='trigger') THEN
        ALTER TABLE workflows ADD COLUMN "trigger" TEXT;
    END IF;
END $$;

-- Add nodes if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflows' AND column_name='nodes') THEN
        ALTER TABLE workflows ADD COLUMN nodes JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Add edges if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflows' AND column_name='edges') THEN
        ALTER TABLE workflows ADD COLUMN edges JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Optional: Create index on team_id
CREATE INDEX IF NOT EXISTS idx_workflows_team_id ON workflows(team_id);

COMMIT;
