-- ─── Sistema de Entrenamiento ────────────────────────────────────────────────
-- Una fila por héroe×stat. XP se acumula a 1/hora (pasivo).
-- threshold(n) = round(10 * pow(1.5, n)) donde n = total_gained
CREATE TABLE IF NOT EXISTS hero_training (
  hero_id           uuid    NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  stat              text    NOT NULL CHECK (stat IN ('strength','agility','attack','defense','intelligence')),
  xp_bank           numeric NOT NULL DEFAULT 0,      -- XP acumulada pendiente de conversión
  total_gained      int     NOT NULL DEFAULT 0,      -- puntos de stat conseguidos por entrenamiento
  last_collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hero_id, stat)
);

-- ─── Catálogo de pociones ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS potion_catalog (
  id            text    PRIMARY KEY,
  name          text    NOT NULL,
  description   text,
  effect_type   text    NOT NULL CHECK (effect_type IN ('hp_restore','atk_boost','def_boost','xp_boost')),
  effect_value  numeric NOT NULL,         -- fracción: 0.30 = 30%
  recipe_gold   int     NOT NULL DEFAULT 0,
  recipe_wood   int     NOT NULL DEFAULT 0,
  recipe_mana   int     NOT NULL DEFAULT 0,
  craft_minutes int     NOT NULL DEFAULT 5,
  min_lab_level int     NOT NULL DEFAULT 1
);

INSERT INTO potion_catalog (id, name, description, effect_type, effect_value, recipe_gold, recipe_wood, recipe_mana, craft_minutes, min_lab_level) VALUES
  ('hp_minor', 'Poción de vida menor',  'Restaura el 30% de los puntos de vida.',         'hp_restore', 0.30, 50,  0, 20, 5,  1),
  ('hp_major', 'Poción de vida mayor',  'Restaura el 70% de los puntos de vida.',         'hp_restore', 0.70, 100, 0, 70, 10, 2),
  ('power',    'Elixir de poder',       '+20% de ataque en el próximo combate.',          'atk_boost',  0.20, 80,  0, 40, 10, 2),
  ('shield',   'Elixir de escudo',      '+20% de defensa en el próximo combate.',         'def_boost',  0.20, 80,  0, 40, 10, 2),
  ('wisdom',   'Elixir de sabiduría',   '+50% de experiencia en la próxima expedición.', 'xp_boost',   0.50, 60,  0, 60, 10, 2)
ON CONFLICT (id) DO NOTHING;

-- ─── Inventario de pociones por héroe ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hero_potions (
  hero_id   uuid NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  potion_id text NOT NULL REFERENCES potion_catalog(id),
  quantity  int  NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (hero_id, potion_id)
);

-- ─── Efectos activos en el héroe (boosts temporales de pociones) ──────────────
-- Formato: {"atk_boost": 0.20, "def_boost": 0.20, "xp_boost": 0.50}
-- Se consumen al usarlos en el siguiente combate/expedición
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS active_effects jsonb NOT NULL DEFAULT '{}';

-- ─── Edificio: Laboratorio ────────────────────────────────────────────────────
-- Se desbloquea cuando el Taller alcanza nivel 2 (gestionado por UNLOCK_TRIGGERS)
-- Insertar fila locked para todos los jugadores que ya existen
INSERT INTO buildings (player_id, type, level, unlocked)
SELECT DISTINCT player_id, 'laboratory', 1, false
FROM buildings
WHERE NOT EXISTS (
  SELECT 1 FROM buildings b2
  WHERE b2.player_id = buildings.player_id AND b2.type = 'laboratory'
)
ON CONFLICT DO NOTHING;
