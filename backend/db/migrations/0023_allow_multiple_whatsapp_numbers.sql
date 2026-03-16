-- Migration: Allow multiple whatsapp numbers per team
ALTER TABLE whatsapp_settings DROP CONSTRAINT IF EXISTS whatsapp_settings_team_id_key;
ALTER TABLE whatsapp_settings ADD CONSTRAINT whatsapp_settings_team_phone_unique UNIQUE(team_id, phone_number_id);
