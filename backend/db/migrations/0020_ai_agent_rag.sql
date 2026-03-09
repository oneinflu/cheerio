BEGIN;

-- CREATE EXTENSION IF NOT EXISTS vector; -- Disable for now if not available

CREATE TABLE ai_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  model_name TEXT NOT NULL DEFAULT 'gpt-4-turbo',
  system_prompt TEXT NOT NULL DEFAULT 'You are a helpful AI assistant for a course enrollment platform. Answer questions based on the provided knowledge base.',
  temperature DECIMAL(3, 2) NOT NULL DEFAULT 0.7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER ai_agent_config_set_updated_at
BEFORE UPDATE ON ai_agent_config
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Insert default config
INSERT INTO ai_agent_config (is_active) VALUES (FALSE);

CREATE TYPE knowledge_source_type AS ENUM ('website', 'pdf', 'text', 'document');

CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type knowledge_source_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT, -- For raw text or extracted content
  source_url TEXT, -- For websites or file URLs
  -- embedding vector(1536), -- Assuming OpenAI ada-002 or similar
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER knowledge_base_set_updated_at
BEFORE UPDATE ON knowledge_base
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add column to conversations to track if AI is handling it
ALTER TABLE conversations ADD COLUMN is_ai_active BOOLEAN DEFAULT TRUE;
-- If an agent is assigned, AI should be inactive.
-- We'll manage this logic in the application layer or triggers.

COMMIT;
