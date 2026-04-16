-- Columnas para rastrear presencia y bonus de regreso
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS last_seen_at        timestamptz,
  ADD COLUMN IF NOT EXISTS comeback_claimed_date date;
