-- ═══════════════════════════════════════════════════════════════════════════════
-- Pociones de tiempo y craftables de efectos especiales
--
-- 1. Amplía la CHECK de potion_catalog.effect_type para aceptar:
--    time_reduction, loot_boost, gold_boost, card_guaranteed, free_repair
-- 2. Inserta 3 pociones de tiempo (niveles 2/4/5)
-- 3. Inserta craftables equivalentes a los specials de la tienda (loot_boost,
--    gold_boost, card_guaranteed, free_repair) para que no sean solo shop-only
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Ampliar CHECK de effect_type ─────────────────────────────────────────────
ALTER TABLE potion_catalog DROP CONSTRAINT IF EXISTS potion_catalog_effect_type_check;

ALTER TABLE potion_catalog ADD CONSTRAINT potion_catalog_effect_type_check
  CHECK (effect_type IN (
    'hp_restore',
    'atk_boost',
    'def_boost',
    'xp_boost',
    'time_reduction',
    'loot_boost',
    'gold_boost',
    'card_guaranteed',
    'free_repair'
  ));

-- ── 2. Pociones de tiempo ───────────────────────────────────────────────────────
-- Reducen la duración de la próxima expedición o cámara. Se consumen al iniciar.
INSERT INTO potion_catalog
  (id, name, description, effect_type, effect_value, recipe_gold, recipe_wood, recipe_mana, recipe_fragments, recipe_essence, craft_minutes, min_lab_level) VALUES
  ('brisa_errante',  'Brisa del errante',  'Reduce un 20% la duración de la próxima expedición o cámara.', 'time_reduction', 0.20,  70, 0,  40, 0, 0,  8, 2),
  ('paso_viajero',   'Paso del viajero',   'Reduce un 40% la duración de la próxima expedición o cámara.', 'time_reduction', 0.40, 150, 0,  90, 1, 0, 15, 4),
  ('huellas_viento', 'Huellas del viento', 'Reduce un 60% la duración de la próxima expedición o cámara.', 'time_reduction', 0.60, 260, 0, 170, 2, 1, 20, 5)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Craftables de efectos especiales ─────────────────────────────────────────
-- Equivalentes artesanales a los items de la tienda. Usan los mismos
-- effect_type que los specials, así los endpoints que ya los consumen
-- (expedition-collect, chamber-collect, item-repair) no necesitan cambios
-- adicionales.
INSERT INTO potion_catalog
  (id, name, description, effect_type, effect_value, recipe_gold, recipe_wood, recipe_mana, recipe_fragments, recipe_essence, craft_minutes, min_lab_level) VALUES
  ('saqueador_ojo',     'Ojo del saqueador',     'La próxima expedición o cámara tiene +30% de probabilidad de drop de equipo.', 'loot_boost',      0.30, 180, 0,  80, 1, 0, 12, 3),
  ('alquimia_mercader', 'Alquimia del mercader', 'La próxima expedición otorga +50% de oro.',                                    'gold_boost',      0.50, 140, 0,  60, 1, 0, 10, 3),
  ('carta_vidente',     'Carta del vidente',     'Garantiza el drop de una carta en la próxima expedición.',                     'card_guaranteed', 1.00, 220, 0, 140, 2, 0, 15, 4),
  ('aceite_forjador',   'Aceite del forjador',   'La próxima reparación manual del héroe es gratis.',                            'free_repair',     1.00,  90, 0,  50, 0, 0,  8, 2)
ON CONFLICT (id) DO NOTHING;
