BEGIN;

CREATE TABLE whatsapp_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  flow_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER whatsapp_flows_set_updated_at
BEFORE UPDATE ON whatsapp_flows
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

