-- Catálogo de runas V2: restricciones por clase + runas T2 + runas combinadas por clase

-- 1. Añadir columna de restricción de clase al catálogo de crafteo
ALTER TABLE crafting_catalog
  ADD COLUMN IF NOT EXISTS class_restrictions TEXT[] DEFAULT NULL;

-- 2. Restricciones para las 6 runas T1 existentes
UPDATE crafting_catalog SET class_restrictions = ARRAY['caudillo','domador','universal']   WHERE id = 'rune_strength';
UPDATE crafting_catalog SET class_restrictions = ARRAY['sombra','domador','universal']     WHERE id = 'rune_agility';
UPDATE crafting_catalog SET class_restrictions = ARRAY['arcanista','domador','universal']  WHERE id = 'rune_intelligence';
UPDATE crafting_catalog SET class_restrictions = ARRAY['sombra','arcanista','universal']   WHERE id = 'rune_attack';
UPDATE crafting_catalog SET class_restrictions = ARRAY['caudillo','sombra','universal']    WHERE id = 'rune_defense';
UPDATE crafting_catalog SET class_restrictions = ARRAY['caudillo','arcanista','universal'] WHERE id = 'rune_hp';

-- 3. Runas T2 (stat único, ×2.5 potencia, ×2.5 coste)
INSERT INTO crafting_catalog
  (id, name, description, icon, category, refinery_type, min_refinery_level, craft_minutes, inputs, effects, class_restrictions)
VALUES
  ('rune_strength_ii',
   'Runa de Fuerza II', '+20 Fuerza permanente al ítem', '💪',
   'rune', 'laboratory', 1, 35,
   '[{"resource":"iron","qty":100},{"resource":"herbs","qty":75},{"resource":"fragments","qty":10}]',
   '[{"type":"enchant","stat":"strength_bonus","value":20}]',
   ARRAY['caudillo','domador','universal']),

  ('rune_agility_ii',
   'Runa de Agilidad II', '+20 Agilidad permanente al ítem', '💨',
   'rune', 'laboratory', 1, 35,
   '[{"resource":"wood","qty":75},{"resource":"mana","qty":75},{"resource":"fragments","qty":10}]',
   '[{"type":"enchant","stat":"agility_bonus","value":20}]',
   ARRAY['sombra','domador','universal']),

  ('rune_intelligence_ii',
   'Runa de Inteligencia II', '+20 Inteligencia permanente al ítem', '🔮',
   'rune', 'laboratory', 1, 35,
   '[{"resource":"mana","qty":110},{"resource":"herbs","qty":75},{"resource":"fragments","qty":12},{"resource":"essence","qty":5}]',
   '[{"type":"enchant","stat":"intelligence_bonus","value":20}]',
   ARRAY['arcanista','domador','universal']),

  ('rune_attack_ii',
   'Runa de Ataque II', '+25 Ataque permanente al ítem', '⚔️',
   'rune', 'laboratory', 1, 35,
   '[{"resource":"iron","qty":125},{"resource":"mana","qty":50},{"resource":"fragments","qty":10}]',
   '[{"type":"enchant","stat":"attack_bonus","value":25}]',
   ARRAY['sombra','arcanista','universal']),

  ('rune_defense_ii',
   'Runa de Defensa II', '+25 Defensa permanente al ítem', '🛡️',
   'rune', 'laboratory', 1, 35,
   '[{"resource":"iron","qty":125},{"resource":"wood","qty":50},{"resource":"fragments","qty":10}]',
   '[{"type":"enchant","stat":"defense_bonus","value":25}]',
   ARRAY['caudillo','sombra','universal']),

  ('rune_hp_ii',
   'Runa de Vida II', '+200 HP máximo permanente al ítem', '💚',
   'rune', 'laboratory', 1, 35,
   '[{"resource":"wood","qty":100},{"resource":"herbs","qty":85},{"resource":"fragments","qty":12}]',
   '[{"type":"enchant","stat":"hp_bonus","value":200}]',
   ARRAY['caudillo','arcanista','universal']),

-- 4. Runas combinadas exclusivas por clase (2 stats, ocupan 2 slots de runa)

  -- Caudillo: strength + defense + hp
  ('rune_iron_will',
   'Voluntad de Hierro', '+12 Fuerza y +18 Defensa', '🗡️',
   'rune', 'laboratory', 1, 25,
   '[{"resource":"iron","qty":90},{"resource":"herbs","qty":50},{"resource":"fragments","qty":8}]',
   '[{"type":"enchant","stat":"strength_bonus","value":12},{"type":"enchant","stat":"defense_bonus","value":18}]',
   ARRAY['caudillo','universal']),

  ('rune_bulwark',
   'Bastión', '+25 Defensa y +150 HP máximo', '🏰',
   'rune', 'laboratory', 1, 25,
   '[{"resource":"iron","qty":90},{"resource":"wood","qty":70},{"resource":"fragments","qty":9}]',
   '[{"type":"enchant","stat":"defense_bonus","value":25},{"type":"enchant","stat":"hp_bonus","value":150}]',
   ARRAY['caudillo','universal']),

  -- Sombra: agility + attack + defense
  ('rune_swift_strike',
   'Golpe Veloz', '+14 Agilidad y +18 Ataque', '⚡',
   'rune', 'laboratory', 1, 25,
   '[{"resource":"wood","qty":55},{"resource":"iron","qty":70},{"resource":"mana","qty":40},{"resource":"fragments","qty":8}]',
   '[{"type":"enchant","stat":"agility_bonus","value":14},{"type":"enchant","stat":"attack_bonus","value":18}]',
   ARRAY['sombra','universal']),

  ('rune_shadow_veil',
   'Velo de Sombras', '+12 Agilidad y +18 Defensa', '🌑',
   'rune', 'laboratory', 1, 25,
   '[{"resource":"wood","qty":55},{"resource":"iron","qty":70},{"resource":"fragments","qty":8}]',
   '[{"type":"enchant","stat":"agility_bonus","value":12},{"type":"enchant","stat":"defense_bonus","value":18}]',
   ARRAY['sombra','universal']),

  -- Arcanista: intelligence + attack + hp
  ('rune_arcane_surge',
   'Oleada Arcana', '+14 Inteligencia y +18 Ataque', '✨',
   'rune', 'laboratory', 1, 25,
   '[{"resource":"mana","qty":80},{"resource":"iron","qty":70},{"resource":"herbs","qty":50},{"resource":"fragments","qty":9},{"resource":"essence","qty":1}]',
   '[{"type":"enchant","stat":"intelligence_bonus","value":14},{"type":"enchant","stat":"attack_bonus","value":18}]',
   ARRAY['arcanista','universal']),

  ('rune_mana_barrier',
   'Barrera de Maná', '+18 Inteligencia y +150 HP máximo', '🔷',
   'rune', 'laboratory', 1, 25,
   '[{"resource":"mana","qty":80},{"resource":"herbs","qty":60},{"resource":"wood","qty":60},{"resource":"fragments","qty":9},{"resource":"essence","qty":2}]',
   '[{"type":"enchant","stat":"intelligence_bonus","value":18},{"type":"enchant","stat":"hp_bonus","value":150}]',
   ARRAY['arcanista','universal']),

  -- Domador: strength + agility + intelligence
  ('rune_predator',
   'Depredador', '+14 Fuerza y +14 Agilidad', '🐺',
   'rune', 'laboratory', 1, 25,
   '[{"resource":"iron","qty":70},{"resource":"wood","qty":55},{"resource":"herbs","qty":50},{"resource":"fragments","qty":8}]',
   '[{"type":"enchant","stat":"strength_bonus","value":14},{"type":"enchant","stat":"agility_bonus","value":14}]',
   ARRAY['domador','universal']),

  ('rune_primal_mind',
   'Mente Primaria', '+14 Agilidad y +14 Inteligencia', '🌿',
   'rune', 'laboratory', 1, 25,
   '[{"resource":"wood","qty":55},{"resource":"mana","qty":70},{"resource":"herbs","qty":55},{"resource":"fragments","qty":9},{"resource":"essence","qty":1}]',
   '[{"type":"enchant","stat":"agility_bonus","value":14},{"type":"enchant","stat":"intelligence_bonus","value":14}]',
   ARRAY['domador','universal'])

ON CONFLICT (id) DO NOTHING;
