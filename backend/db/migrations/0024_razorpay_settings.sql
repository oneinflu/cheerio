-- 0024_razorpay_settings.sql
-- Create razorpay_settings table for multi-tenant keys

CREATE TABLE IF NOT EXISTS razorpay_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  key_id TEXT NOT NULL,
  key_secret TEXT NOT NULL,
  webhook_secret TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id)
);
