-- Inventario compartido de Laboratorio: pociones y runas pasan de héroe a jugador
-- El crafteo y el stock se vinculan a player_id en vez de hero_id

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Inventario de pociones por jugador
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS player_potions (
  player_id uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  potion_id text    NOT NULL REFERENCES potion_catalog(id),
  quantity  int     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (player_id, potion_id)
);

ALTER TABLE player_potions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_potions_own" ON player_potions
  FOR ALL USING (player_id = auth.uid());

-- Migrar datos: agrupar cantidades de todos los héroes del mismo jugador
INSERT INTO player_potions (player_id, potion_id, quantity)
SELECT h.player_id, hp.potion_id, SUM(hp.quantity)::int
FROM hero_potions hp
JOIN heroes h ON h.id = hp.hero_id
GROUP BY h.player_id, hp.potion_id
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Inventario de runas por jugador
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS player_runes (
  player_id uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rune_id   integer NOT NULL REFERENCES rune_catalog(id),
  quantity  int     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (player_id, rune_id)
);

ALTER TABLE player_runes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_runes_own" ON player_runes
  FOR ALL USING (player_id = auth.uid());

-- Migrar datos
INSERT INTO player_runes (player_id, rune_id, quantity)
SELECT h.player_id, hr.rune_id, SUM(hr.quantity)::int
FROM hero_runes hr
JOIN heroes h ON h.id = hr.hero_id
GROUP BY h.player_id, hr.rune_id
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Cola de crafteo de pociones → por jugador
-- ═══════════════════════════════════════════════════════════════════════════════

-- Crear nueva tabla con player_id
CREATE TABLE IF NOT EXISTS player_potion_crafting (
  player_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  potion_id     text        NOT NULL REFERENCES potion_catalog(id),
  craft_ends_at timestamptz NOT NULL,
  PRIMARY KEY (player_id, potion_id)
);

ALTER TABLE player_potion_crafting ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_potion_crafting_own" ON player_potion_crafting
  FOR ALL USING (player_id = auth.uid());

-- Migrar crafteos activos
INSERT INTO player_potion_crafting (player_id, potion_id, craft_ends_at)
SELECT DISTINCT ON (h.player_id, pc.potion_id) h.player_id, pc.potion_id, pc.craft_ends_at
FROM potion_crafting pc
JOIN heroes h ON h.id = pc.hero_id
ORDER BY h.player_id, pc.potion_id, pc.craft_ends_at DESC
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Cola de crafteo de runas → por jugador
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS player_rune_crafting (
  player_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rune_id       integer     NOT NULL REFERENCES rune_catalog(id),
  craft_ends_at timestamptz NOT NULL,
  PRIMARY KEY (player_id, rune_id)
);

ALTER TABLE player_rune_crafting ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_rune_crafting_own" ON player_rune_crafting
  FOR ALL USING (player_id = auth.uid());

-- Migrar crafteos activos
INSERT INTO player_rune_crafting (player_id, rune_id, craft_ends_at)
SELECT DISTINCT ON (h.player_id, rc.rune_id) h.player_id, rc.rune_id, rc.craft_ends_at
FROM rune_crafting rc
JOIN heroes h ON h.id = rc.hero_id
ORDER BY h.player_id, rc.rune_id, rc.craft_ends_at DESC
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Ampliaciones del inventario del laboratorio
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE resources ADD COLUMN IF NOT EXISTS lab_inventory_upgrades int NOT NULL DEFAULT 0;
