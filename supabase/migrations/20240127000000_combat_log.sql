-- Añadir log y stats al combate para replay persistente (Torre + futuro PvP)
ALTER TABLE tower_attempts
  ADD COLUMN IF NOT EXISTS log          jsonb,
  ADD COLUMN IF NOT EXISTS hero_name    text,
  ADD COLUMN IF NOT EXISTS enemy_name   text,
  ADD COLUMN IF NOT EXISTS hero_max_hp  integer,
  ADD COLUMN IF NOT EXISTS enemy_max_hp integer;
