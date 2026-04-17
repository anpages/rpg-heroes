-- Tabla genérica de historial de combate (torre + grindeo)
CREATE TABLE IF NOT EXISTS combat_log (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  hero_id    uuid        NOT NULL REFERENCES heroes(id)   ON DELETE CASCADE,
  player_id  uuid        NOT NULL,
  source     text        NOT NULL,   -- 'torre' | 'grind'
  won        boolean     NOT NULL,
  enemy_name text,
  floor      integer,               -- solo torre
  rounds     integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS combat_log_hero_idx ON combat_log (hero_id, created_at DESC);

-- RPC atómica para incrementar contadores de combate en el héroe
CREATE OR REPLACE FUNCTION increment_combat_stats(p_hero_id uuid, p_won boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE heroes
  SET combats_played = combats_played + 1,
      combats_won    = combats_won + CASE WHEN p_won THEN 1 ELSE 0 END
  WHERE id = p_hero_id;
END;
$$;
