-- Torre de Desafíos: progreso y registro de intentos

CREATE TABLE tower_progress (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id     uuid NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  max_floor   integer NOT NULL DEFAULT 0,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(hero_id)
);

CREATE TABLE tower_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id       uuid NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  floor         integer NOT NULL,
  won           boolean NOT NULL,
  rounds        integer NOT NULL,
  hero_hp_left  integer NOT NULL,
  enemy_hp_left integer NOT NULL,
  attempted_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_tower_progress_hero ON tower_progress(hero_id);
CREATE INDEX idx_tower_attempts_hero ON tower_attempts(hero_id, attempted_at DESC);

-- RLS
ALTER TABLE tower_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tower_attempts   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tower_progress_own" ON tower_progress
  FOR ALL USING (
    hero_id IN (SELECT id FROM heroes WHERE player_id = auth.uid())
  );

CREATE POLICY "tower_attempts_own" ON tower_attempts
  FOR ALL USING (
    hero_id IN (SELECT id FROM heroes WHERE player_id = auth.uid())
  );

-- Inicializar progreso para héroes existentes
INSERT INTO tower_progress (hero_id, max_floor)
SELECT id, 0 FROM heroes
ON CONFLICT (hero_id) DO NOTHING;
