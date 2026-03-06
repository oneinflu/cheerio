BEGIN;

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'en_US',
  category TEXT NOT NULL DEFAULT 'MARKETING',
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'LOCAL', -- 'LOCAL', 'PENDING', 'APPROVED', 'REJECTED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER whatsapp_templates_set_updated_at
BEFORE UPDATE ON whatsapp_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
