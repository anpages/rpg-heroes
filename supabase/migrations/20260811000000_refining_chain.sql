-- ══════════════════════════════════════════════════════════════════════════════
-- Cadena de producción en refinado + taller usa refinados T2
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Segundo item de refinado requiere primer item + recurso primario
UPDATE crafting_catalog SET
  inputs = '[{"resource":"wood","qty":20},{"item":"plank","qty":10}]'::jsonb
WHERE id = 'composite_wood';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"iron","qty":20},{"item":"steel_ingot","qty":10}]'::jsonb
WHERE id = 'tempered_steel';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"mana","qty":20},{"item":"mana_crystal","qty":10}]'::jsonb
WHERE id = 'concentrated_mana';

UPDATE crafting_catalog SET
  inputs = '[{"resource":"herbs","qty":20},{"item":"herbal_extract","qty":10}]'::jsonb
WHERE id = 'potion_base';

-- 2. Todas las recetas de refinado en nivel 1 (sin niveles de edificio)
UPDATE crafting_catalog SET min_refinery_level = 1
WHERE refinery_type IN ('carpinteria','fundicion','destileria_arcana','herbolario');

-- 3. Taller: pociones usan herbolario + destilería
-- Poción Vida Menor (Nv1): extracto ×1, cristal ×1 (T1 herbolario + T1 destilería)
UPDATE crafting_catalog SET
  inputs = '[{"item":"herbal_extract","qty":1},{"item":"mana_crystal","qty":1}]'::jsonb
WHERE id = 'hp_potion_minor';

-- Poción Vida Mayor (Nv3): base poción ×1, maná concentrado ×1 (T2 herbolario + T2 destilería)
UPDATE crafting_catalog SET
  inputs = '[{"item":"potion_base","qty":1},{"item":"concentrated_mana","qty":1}]'::jsonb
WHERE id = 'hp_potion_major';

-- 4. Taller: kits usan fundición + carpintería
-- Kit Reparación (Nv1): lingote ×2, tablón ×1 (T1 fundición + T1 carpintería)
-- (ya correcto de migración anterior, no cambiar)

-- Kit Reparación Completo (Nv3): acero templado ×1, madera compuesta ×1 (T2 fundición + T2 carpintería)
UPDATE crafting_catalog SET
  inputs = '[{"item":"tempered_steel","qty":1},{"item":"composite_wood","qty":1}]'::jsonb
WHERE id = 'repair_kit_full';

-- 5. Piedras de forja: mix de refinados
-- Piedra Forja T2 (Nv2): acero templado ×1, cristal ×1, fragmentos ×2
-- (ya correcto)
-- Piedra Forja T3 (Nv4): acero templado ×2, maná concentrado ×1, esencia ×4
-- (ya correcto)

-- 6. Bajar refinerías con nivel > 1 a nivel 1 (ya no se sube de nivel)
UPDATE buildings SET level = 1 WHERE type IN ('carpinteria','fundicion','destileria_arcana','herbolario') AND level > 1;
