-- ══════════════════════════════════════════════════════════════════════════════
-- Actualizar inputs de crafteo: usar materiales procesados en vez de recursos crudos
-- ══════════════════════════════════════════════════════════════════════════════

-- Kit de Reparación: Lingote ×2, Tablón ×1
UPDATE crafting_catalog
SET inputs = '[{"item":"steel_ingot","qty":2},{"item":"plank","qty":1}]'::jsonb
WHERE id = 'repair_kit';

-- Kit de Reparación Completo: Acero Templado ×2, Madera Compuesta ×1, Cristal ×1
UPDATE crafting_catalog
SET inputs = '[{"item":"tempered_steel","qty":2},{"item":"composite_wood","qty":1},{"item":"mana_crystal","qty":1}]'::jsonb
WHERE id = 'repair_kit_full';

-- Piedra de Forja T2: Acero Templado ×1, Extracto ×1, Fragmentos ×2
UPDATE crafting_catalog
SET inputs = '[{"item":"tempered_steel","qty":1},{"item":"herbal_extract","qty":1},{"resource":"fragments","qty":2}]'::jsonb
WHERE id = 'forge_stone_t2';

-- Piedra de Forja T3: Acero Templado ×2, Maná Concentrado ×1, Fragmentos ×6, Esencia ×2
UPDATE crafting_catalog
SET inputs = '[{"item":"tempered_steel","qty":2},{"item":"concentrated_mana","qty":1},{"resource":"fragments","qty":6},{"resource":"essence","qty":2}]'::jsonb
WHERE id = 'forge_stone_t3';

-- Pergamino Táctico: Maná Concentrado ×1, Extracto ×1, Fragmentos ×3
UPDATE crafting_catalog
SET inputs = '[{"item":"concentrated_mana","qty":1},{"item":"herbal_extract","qty":1},{"resource":"fragments","qty":3}]'::jsonb
WHERE id = 'tactic_scroll';

-- Tónico de Entrenamiento: Extracto ×2, Cristal ×1
UPDATE crafting_catalog
SET inputs = '[{"item":"herbal_extract","qty":2},{"item":"mana_crystal","qty":1}]'::jsonb
WHERE id = 'training_tonic';
