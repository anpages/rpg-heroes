-- ══════════════════════════════════════════════════════════════════════════════
-- Edificios de refinado: 4 edificios independientes con cola propia
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Nuevas columnas en crafting_catalog para vincular recetas a edificios de refinado
ALTER TABLE crafting_catalog
  ADD COLUMN IF NOT EXISTS refinery_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_refinery_level int DEFAULT NULL;

-- 2. Asignar cada receta de refinado a su edificio
-- Fundición (mineral → lingote / acero templado)
UPDATE crafting_catalog
SET refinery_type = 'fundicion', min_refinery_level = 1, min_lab_level = 0
WHERE id = 'steel_ingot';

UPDATE crafting_catalog
SET refinery_type = 'fundicion', min_refinery_level = 3, min_lab_level = 0
WHERE id = 'tempered_steel';

-- Carpintería (madera → tablón / madera compuesta)
UPDATE crafting_catalog
SET refinery_type = 'carpinteria', min_refinery_level = 1, min_lab_level = 0
WHERE id = 'plank';

UPDATE crafting_catalog
SET refinery_type = 'carpinteria', min_refinery_level = 3, min_lab_level = 0
WHERE id = 'composite_wood';

-- Destilería Arcana (maná → cristal / maná concentrado)
UPDATE crafting_catalog
SET refinery_type = 'destileria_arcana', min_refinery_level = 1, min_lab_level = 0
WHERE id = 'mana_crystal';

UPDATE crafting_catalog
SET refinery_type = 'destileria_arcana', min_refinery_level = 3, min_lab_level = 0
WHERE id = 'concentrated_mana';

-- Herbolario (hierbas → extracto / base de poción)
UPDATE crafting_catalog
SET refinery_type = 'herbolario', min_refinery_level = 1, min_lab_level = 0
WHERE id = 'herbal_extract';

UPDATE crafting_catalog
SET refinery_type = 'herbolario', min_refinery_level = 3, min_lab_level = 0
WHERE id = 'potion_base';

-- 3. Columna building_type en la cola de crafteo para particionar colas
--    NULL = cola del Taller, 'carpinteria'/'fundicion'/etc. = cola del edificio
ALTER TABLE player_crafting_queue
  ADD COLUMN IF NOT EXISTS building_type text DEFAULT NULL;

-- 4. Insertar 4 edificios de refinado para jugadores existentes
-- Carpintería: nivel 1, desbloqueada (disponible desde el inicio)
INSERT INTO buildings (player_id, type, level, unlocked)
SELECT p.id, 'carpinteria', 1, true
FROM players p
WHERE NOT EXISTS (
  SELECT 1 FROM buildings b WHERE b.player_id = p.id AND b.type = 'carpinteria'
);

-- Fundición: nivel 1, desbloqueada (disponible desde el inicio)
INSERT INTO buildings (player_id, type, level, unlocked)
SELECT p.id, 'fundicion', 1, true
FROM players p
WHERE NOT EXISTS (
  SELECT 1 FROM buildings b WHERE b.player_id = p.id AND b.type = 'fundicion'
);

-- Destilería Arcana: nivel 0, desbloqueada pero sin construir (requiere base Nv2)
INSERT INTO buildings (player_id, type, level, unlocked)
SELECT p.id, 'destileria_arcana', 0, true
FROM players p
WHERE NOT EXISTS (
  SELECT 1 FROM buildings b WHERE b.player_id = p.id AND b.type = 'destileria_arcana'
);

-- Herbolario: nivel 0, desbloqueado pero sin construir (requiere base Nv2)
INSERT INTO buildings (player_id, type, level, unlocked)
SELECT p.id, 'herbolario', 0, true
FROM players p
WHERE NOT EXISTS (
  SELECT 1 FROM buildings b WHERE b.player_id = p.id AND b.type = 'herbolario'
);
