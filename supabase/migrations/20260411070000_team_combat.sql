-- Team Combat (3v3 PvE "Escuadrón")
-- Persiste el resultado de cada incursión de escuadrón para historial y replay.
-- Los 3 héroes participantes se almacenan como array ordenado (a1, a2, a3),
-- y del mismo modo sus nombres, max_hp y los del equipo rival generado.

CREATE TABLE IF NOT EXISTS team_combats (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hero_ids       uuid[] NOT NULL,
  hero_names     text[] NOT NULL,
  hero_classes   text[] NOT NULL,
  hero_max_hps   integer[] NOT NULL,
  enemy_names    text[] NOT NULL,
  enemy_classes  text[] NOT NULL,
  enemy_max_hps  integer[] NOT NULL,
  won            boolean NOT NULL,
  rounds         integer NOT NULL,
  log            jsonb NOT NULL,
  gold_reward    integer NOT NULL DEFAULT 0,
  xp_reward      integer NOT NULL DEFAULT 0,
  synergy_bonus  numeric(4,2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_combats_player_idx
  ON team_combats (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS team_combats_hero_ids_idx
  ON team_combats USING GIN (hero_ids);

ALTER TABLE team_combats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_combats_select_own"
  ON team_combats FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "team_combats_insert_own"
  ON team_combats FOR INSERT
  WITH CHECK (auth.uid() = player_id);
