BEGIN;

CREATE TABLE template_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER template_settings_updated_at
BEFORE UPDATE ON template_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
