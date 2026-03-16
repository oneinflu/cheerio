-- Migration: Add Telegram support
-- Extends channel_type enum and adds telegram_settings table

-- First, update the channel_type enum to include 'telegram'
ALTER TYPE channel_type ADD VALUE 'telegram' BEFORE 'instagram';

-- Create telegram_settings table (similar to whatsapp_settings)
CREATE TABLE IF NOT EXISTS telegram_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL,
    bot_token TEXT NOT NULL,
    bot_username TEXT,
    display_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, bot_token)
);

CREATE INDEX IF NOT EXISTS idx_telegram_settings_team_id ON telegram_settings(team_id);
CREATE INDEX IF NOT EXISTS idx_telegram_settings_bot_token ON telegram_settings(bot_token);

-- Add telegram_user_id to contacts profile for storing Telegram user IDs
-- (This is already supported via the profile JSONB field, no schema change needed)

-- Add comment
COMMENT ON TABLE telegram_settings IS 'Telegram bot configuration per team with bot token and username';
