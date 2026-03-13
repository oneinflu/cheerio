-- Migration: Add whatsapp_settings table
CREATE TABLE IF NOT EXISTS whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL,
    phone_number_id TEXT NOT NULL,
    business_account_id TEXT NOT NULL,
    permanent_token TEXT NOT NULL,
    display_phone_number TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_team_id ON whatsapp_settings(team_id);
