-- ══════════════════════════════════════════════════════════════════════════════
-- Taller unificado: pociones + crafteo en un solo sistema
-- Elimina sistema de pociones separado, todo es crafting_catalog + player_crafted_items
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Añadir columna effects a crafting_catalog para items usables
ALTER TABLE crafting_catalog
  ADD COLUMN IF NOT EXISTS effects jsonb DEFAULT NULL;

-- 2. Eliminar recetas obsoletas del taller (training_tonic, tactic_scroll)
DELETE FROM player_crafting_queue WHERE recipe_id IN ('training_tonic', 'tactic_scroll');
DELETE FROM player_crafted_items WHERE recipe_id IN ('training_tonic', 'tactic_scroll');
DELETE FROM crafting_catalog WHERE id IN ('training_tonic', 'tactic_scroll');

-- 3. Mover recetas existentes del taller al sistema de refinado (refinery_type = 'laboratory')
UPDATE crafting_catalog
SET refinery_type = 'laboratory', min_refinery_level = min_lab_level
WHERE refinery_type IS NULL AND category != 'refining';

-- 4. Actualizar categorías de las existentes
UPDATE crafting_catalog SET category = 'repair' WHERE id IN ('repair_kit', 'repair_kit_full');
UPDATE crafting_catalog SET category = 'forge'  WHERE id IN ('forge_stone_t2', 'forge_stone_t3');

-- 5. Actualizar inputs y tiempos de recetas existentes para usar materiales progresivos
-- Kit de Reparación (Nv1): Lingote ×2, Tablón ×1
UPDATE crafting_catalog
SET inputs = '[{"item":"steel_ingot","qty":2},{"item":"plank","qty":1}]'::jsonb,
    craft_minutes = 10, min_refinery_level = 1, description = 'Restaura parte de la durabilidad de un equipo.'
WHERE id = 'repair_kit';

-- Kit de Reparación Completo (Nv3): Marco Reforzado ×1, Placa Blindaje ×1, Extracto ×1
UPDATE crafting_catalog
SET inputs = '[{"item":"reinforced_frame","qty":1},{"item":"armor_plate","qty":1},{"item":"herbal_extract","qty":1}]'::jsonb,
    craft_minutes = 15, min_refinery_level = 3, description = 'Restaura toda la durabilidad de un equipo.'
WHERE id = 'repair_kit_full';

-- Piedra de Forja T2 (Nv2): Acero Templado ×1, Extracto ×1, fragmentos ×2
UPDATE crafting_catalog
SET inputs = '[{"item":"tempered_steel","qty":1},{"item":"herbal_extract","qty":1},{"resource":"fragments","qty":2}]'::jsonb,
    craft_minutes = 20, min_refinery_level = 2, description = 'Mejora un equipo de Tier 1 a Tier 2.'
WHERE id = 'forge_stone_t2';

-- Piedra de Forja T3 (Nv4): Engranaje ×2, Lente Maná ×1, esencia ×4
UPDATE crafting_catalog
SET inputs = '[{"item":"steel_gear","qty":2},{"item":"mana_lens","qty":1},{"resource":"essence","qty":4}]'::jsonb,
    craft_minutes = 30, min_refinery_level = 4, description = 'Mejora un equipo de Tier 2 a Tier 3.'
WHERE id = 'forge_stone_t3';

-- 6. Insertar POCIONES como items del taller (category: 'potion')
INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level, effects)
VALUES
  ('hp_potion_minor', 'Poción de Vida Menor', 'Restaura un 30% del HP máximo del héroe.',
   'potion', '❤️', '[{"item":"potion_base","qty":1},{"item":"herbal_extract","qty":1}]',
   1, 5, 0, 'laboratory', 1, '[{"type":"hp_restore","value":0.30}]'::jsonb),

  ('atk_elixir', 'Elixir de Poder', '+20% de ataque en el próximo combate.',
   'potion', '⚔️', '[{"item":"potion_base","qty":1},{"item":"steel_ingot","qty":1}]',
   1, 8, 0, 'laboratory', 2, '[{"type":"atk_boost","value":0.20}]'::jsonb),

  ('def_elixir', 'Elixir de Escudo', '+20% de defensa en el próximo combate.',
   'potion', '🛡️', '[{"item":"potion_base","qty":1},{"item":"plank","qty":1}]',
   1, 8, 0, 'laboratory', 2, '[{"type":"def_boost","value":0.20}]'::jsonb),

  ('hp_potion_major', 'Poción de Vida Mayor', 'Restaura un 70% del HP máximo del héroe.',
   'potion', '💖', '[{"item":"potion_base","qty":2},{"item":"herbal_extract","qty":2}]',
   1, 10, 0, 'laboratory', 3, '[{"type":"hp_restore","value":0.70}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 7. Insertar ITEMS DE EXPEDICIÓN
INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level, effects)
VALUES
  ('travel_ration', 'Ración de Viaje', 'Reduce un 30% el coste de HP de la siguiente expedición.',
   'expedition', '🍖', '[{"item":"herbal_extract","qty":2},{"item":"plank","qty":1}]',
   1, 8, 0, 'laboratory', 1, '[{"type":"hp_cost_reduction","value":0.30}]'::jsonb),

  ('explorer_map', 'Mapa del Explorador', 'Reduce un 20% el tiempo de la siguiente expedición.',
   'expedition', '🗺️', '[{"item":"concentrated_mana","qty":1},{"item":"composite_wood","qty":1}]',
   1, 12, 0, 'laboratory', 2, '[{"type":"time_reduction","value":0.20}]'::jsonb),

  ('xp_seal', 'Sello de Experiencia', '+50% de experiencia en la siguiente expedición.',
   'expedition', '📜', '[{"item":"potion_base","qty":2},{"item":"mana_crystal","qty":1}]',
   1, 12, 0, 'laboratory', 2, '[{"type":"xp_boost","value":0.50}]'::jsonb),

  ('loot_amulet', 'Amuleto de Botín', '+30% de loot en la siguiente expedición.',
   'expedition', '🔮', '[{"item":"concentrated_elixir","qty":1},{"item":"arcane_prism","qty":1},{"resource":"fragments","qty":3}]',
   1, 15, 0, 'laboratory', 3, '[{"type":"loot_boost","value":0.30}]'::jsonb),

  ('enchanted_compass', 'Brújula Encantada', 'Reduce un 35% el tiempo de la siguiente expedición.',
   'expedition', '🧭', '[{"item":"mana_lens","qty":1},{"item":"essential_oil","qty":1},{"resource":"fragments","qty":4}]',
   1, 20, 0, 'laboratory', 4, '[{"type":"time_reduction","value":0.35}]'::jsonb),

  ('looter_eye', 'Ojo del Saqueador', '+50% de loot en la siguiente expedición.',
   'expedition', '👁️', '[{"item":"steel_gear","qty":1},{"item":"essential_oil","qty":2},{"resource":"essence","qty":2}]',
   1, 20, 0, 'laboratory', 4, '[{"type":"loot_boost","value":0.50}]'::jsonb),

  ('explorer_talisman', 'Talismán del Explorador', '-35% tiempo + 30% loot en la siguiente expedición.',
   'expedition', '🏅', '[{"item":"arcane_condenser","qty":1},{"item":"cataplasm","qty":1},{"resource":"fragments","qty":6}]',
   1, 25, 0, 'laboratory', 5, '[{"type":"time_reduction","value":0.35},{"type":"loot_boost","value":0.30}]'::jsonb),

  ('merchant_alchemy', 'Alquimia del Mercader', '+50% de oro en la siguiente expedición.',
   'expedition', '💰', '[{"item":"arcane_condenser","qty":1},{"item":"cataplasm","qty":1},{"resource":"essence","qty":6}]',
   1, 20, 0, 'laboratory', 5, '[{"type":"gold_boost","value":0.50}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 8. Insertar ITEMS DE TORRE
INSERT INTO crafting_catalog (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level, effects)
VALUES
  ('tower_shield', 'Escudo de Torre', '-50% pérdida de durabilidad en el siguiente intento de torre.',
   'tower', '🏰', '[{"item":"armor_plate","qty":2},{"item":"reinforced_frame","qty":1}]',
   1, 15, 0, 'laboratory', 3, '[{"type":"tower_shield","value":0.50}]'::jsonb),

  ('reinforced_shield', 'Escudo Reforzado', '-75% pérdida de durabilidad en el siguiente intento de torre.',
   'tower', '🏰', '[{"item":"forged_steel","qty":2},{"item":"assembled_panel","qty":1},{"resource":"essence","qty":4}]',
   1, 25, 0, 'laboratory', 5, '[{"type":"tower_shield","value":0.75}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 9. Migrar inventario de pociones a player_crafted_items
-- Mapeo: potion_id viejo → recipe_id nuevo (solo las 4 que conservamos)
-- hp_minor → hp_potion_minor, hp_major → hp_potion_major
-- power → atk_elixir, shield → def_elixir
INSERT INTO player_crafted_items (player_id, recipe_id, quantity)
SELECT player_id, 'hp_potion_minor', quantity
FROM player_potions WHERE potion_id = 'hp_minor' AND quantity > 0
ON CONFLICT (player_id, recipe_id) DO UPDATE SET quantity = player_crafted_items.quantity + EXCLUDED.quantity;

INSERT INTO player_crafted_items (player_id, recipe_id, quantity)
SELECT player_id, 'hp_potion_major', quantity
FROM player_potions WHERE potion_id = 'hp_major' AND quantity > 0
ON CONFLICT (player_id, recipe_id) DO UPDATE SET quantity = player_crafted_items.quantity + EXCLUDED.quantity;

INSERT INTO player_crafted_items (player_id, recipe_id, quantity)
SELECT player_id, 'atk_elixir', quantity
FROM player_potions WHERE potion_id = 'power' AND quantity > 0
ON CONFLICT (player_id, recipe_id) DO UPDATE SET quantity = player_crafted_items.quantity + EXCLUDED.quantity;

INSERT INTO player_crafted_items (player_id, recipe_id, quantity)
SELECT player_id, 'def_elixir', quantity
FROM player_potions WHERE potion_id = 'shield' AND quantity > 0
ON CONFLICT (player_id, recipe_id) DO UPDATE SET quantity = player_crafted_items.quantity + EXCLUDED.quantity;

-- 10. Migrar crafting de pociones activo a player_refining_slots
INSERT INTO player_refining_slots (player_id, building_type, recipe_id, quantity, craft_started_at, unit_duration_ms)
SELECT
  pc.player_id,
  'laboratory',
  CASE pc.potion_id
    WHEN 'hp_minor' THEN 'hp_potion_minor'
    WHEN 'hp_major' THEN 'hp_potion_major'
    WHEN 'power'    THEN 'atk_elixir'
    WHEN 'shield'   THEN 'def_elixir'
    ELSE NULL
  END,
  1,
  pc.craft_ends_at - (p.craft_minutes * interval '1 minute'),
  p.craft_minutes * 60 * 1000
FROM player_potion_crafting pc
JOIN potion_catalog p ON p.id = pc.potion_id
WHERE pc.potion_id IN ('hp_minor', 'hp_major', 'power', 'shield')
ON CONFLICT (player_id, building_type, recipe_id) DO UPDATE
  SET quantity = player_refining_slots.quantity + EXCLUDED.quantity;

-- 11. Migrar jobs del taller viejo (player_crafting_queue con building_type IS NULL)
-- a player_refining_slots con building_type = 'laboratory'
INSERT INTO player_refining_slots (player_id, building_type, recipe_id, quantity, craft_started_at, unit_duration_ms)
SELECT
  q.player_id,
  'laboratory',
  q.recipe_id,
  1,
  q.craft_ends_at - (c.craft_minutes * interval '1 minute'),
  c.craft_minutes * 60 * 1000
FROM player_crafting_queue q
JOIN crafting_catalog c ON c.id = q.recipe_id
WHERE q.building_type IS NULL
ON CONFLICT (player_id, building_type, recipe_id) DO UPDATE
  SET quantity = player_refining_slots.quantity + EXCLUDED.quantity;

-- Limpiar cola vieja del taller
DELETE FROM player_crafting_queue WHERE building_type IS NULL;
