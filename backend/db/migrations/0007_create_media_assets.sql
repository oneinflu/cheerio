BEGIN;

CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind media_kind NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  original_filename TEXT,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_assets_created_at
ON media_assets (created_at DESC);

COMMIT;
