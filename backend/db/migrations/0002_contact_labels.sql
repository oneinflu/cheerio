
CREATE TABLE IF NOT EXISTS contact_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_label_maps (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES contact_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contact_id, label_id)
);

