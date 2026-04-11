-- Sistema de rating de combate (PvE)
-- Solo computa sobre fuentes explícitas: torre, combate rápido y torneo.
-- Tiers: Hierro → Bronce → Plata → Oro → Platino → Diamante → Maestro → Gran Maestro → Leyenda.

ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS combat_rating        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combats_played       integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combats_won          integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_combat_at       timestamptz,
  ADD COLUMN IF NOT EXISTS tier_grace_remaining integer     NOT NULL DEFAULT 0;

-- Índice para el ranking por rating
CREATE INDEX IF NOT EXISTS heroes_combat_rating_idx
  ON heroes (combat_rating DESC, combats_played DESC, level DESC);
