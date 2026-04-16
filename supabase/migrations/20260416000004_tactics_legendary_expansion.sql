-- ── Expansión de catálogo de tácticas: legendarias + relleno de builds ──────
-- Añade 17 tácticas nuevas para llegar a ~80 total.
-- 7 legendarias (2 universales + 1 por cada clase incluida Universal)
-- 3 para clase Universal (de 5 a 8)
-- 7 universales nuevas que cubren mecánicas huérfanas
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- LEGENDARIAS UNIVERSALES (sin required_class)
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.tactic_catalog (name, description, category, rarity, stat_bonuses, combat_effect, icon) VALUES

('Maestro de Guerra',
 'Al caer por debajo del 50% HP tu daño se multiplica permanentemente.',
 'offensive', 'legendary',
 '[{"stat":"strength","value":12},{"stat":"attack","value":10}]',
 '{"trigger":"hp_below_pct","threshold":0.50,"effect":"damage_mult","value":2.00,"duration":99,"once":true}',
 '⚔'),

('Sangre Inmortal',
 'Te regeneras un 4% de tu HP máximo cada ronda de combate.',
 'defensive', 'legendary',
 '[{"stat":"defense","value":12},{"stat":"max_hp","value":40}]',
 '{"trigger":"passive","effect":"heal_pct","value":0.04,"duration":99}',
 '🩸');

-- ══════════════════════════════════════════════════════════════════════════════
-- LEGENDARIAS DE CLASE
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.tactic_catalog (name, description, category, rarity, required_class, stat_bonuses, combat_effect, icon) VALUES

-- CAUDILLO
('Rey de la Batalla',
 'Desde el primer golpe combates con el ímpetu de un rey: daño permanentemente aumentado.',
 'offensive', 'legendary', 'caudillo',
 '[{"stat":"strength","value":14},{"stat":"defense","value":10}]',
 '{"trigger":"start_of_combat","effect":"damage_mult","value":1.40,"duration":99}',
 '👑'),

-- SOMBRA
('Muerte Silenciosa',
 'Inicias el combate en sigilo total durante 2 rondas: esquiva garantizada y crítico asegurado.',
 'offensive', 'legendary', 'sombra',
 '[{"stat":"agility","value":14},{"stat":"attack","value":10}]',
 '{"trigger":"start_of_combat","effect":"stealth","duration":2}',
 '🗡'),

-- ARCANISTA
('Dominio Arcano',
 'En la ronda 5 liberas una explosión arcana que inflige daño mágico puro equivalente al 120% de tu HP máximo.',
 'offensive', 'legendary', 'arcanista',
 '[{"stat":"intelligence","value":16},{"stat":"attack","value":8}]',
 '{"trigger":"round_n","n":5,"effect":"pure_magic_burst","value":1.20}',
 '🔮'),

-- DOMADOR
('Bestia Desatada',
 'Al caer por debajo del 50% HP la bestia interior se libera y tu daño aumenta permanentemente.',
 'offensive', 'legendary', 'domador',
 '[{"stat":"strength","value":14},{"stat":"agility","value":10}]',
 '{"trigger":"hp_below_pct","threshold":0.50,"effect":"damage_mult","value":1.90,"duration":99,"once":true}',
 '🦊'),

-- UNIVERSAL (clase)
('El Todo',
 'Equilibrio total: stats repartidos y reflejas pasivamente el 25% del daño recibido.',
 'utility', 'legendary', 'universal',
 '[{"stat":"strength","value":10},{"stat":"agility","value":10},{"stat":"intelligence","value":10}]',
 '{"trigger":"passive","effect":"reflect_damage","value":0.25,"duration":99}',
 '🌈');

-- ══════════════════════════════════════════════════════════════════════════════
-- CLASE UNIVERSAL — commons + epic que faltan (de 5 a 8)
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.tactic_catalog (name, description, category, rarity, required_class, stat_bonuses, combat_effect, icon) VALUES

('Versatilidad',
 'Dominas todos los aspectos del combate con equilibrio perfecto.',
 'utility', 'common', 'universal',
 '[{"stat":"attack","value":3},{"stat":"defense","value":3},{"stat":"max_hp","value":12}]',
 '{"trigger":"passive","effect":"damage_reduction","value":0.03,"duration":99}',
 '⚖'),

('Adaptabilidad',
 'Tu naturaleza versátil te permite desarrollarte en cualquier situación.',
 'utility', 'common', 'universal',
 '[{"stat":"strength","value":3},{"stat":"agility","value":3},{"stat":"intelligence","value":3}]',
 '{"trigger":"passive","effect":"dodge_boost","value":0.03}',
 '🔄'),

('Convergencia',
 'En la ronda 5, todos tus atributos convergen: daño permanentemente amplificado.',
 'offensive', 'epic', 'universal',
 '[{"stat":"strength","value":8},{"stat":"agility","value":8},{"stat":"intelligence","value":8}]',
 '{"trigger":"round_n","n":5,"effect":"damage_mult","value":1.70,"duration":99}',
 '🌀');

-- ══════════════════════════════════════════════════════════════════════════════
-- UNIVERSALES NUEVAS — cubrir builds huérfanas
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.tactic_catalog (name, description, category, rarity, stat_bonuses, combat_effect, icon) VALUES

-- Sangrado (DoT ofensivo accesible)
('Hemorragia',
 'Al inicio del combate infliges una herida sangrante que daña al enemigo cada ronda.',
 'offensive', 'uncommon',
 '[{"stat":"attack","value":4},{"stat":"strength","value":2}]',
 '{"trigger":"start_of_combat","effect":"dot_damage","value":0.025,"duration":4}',
 '🩸'),

-- Debuff defensa permanente (build penetración)
('Desgaste',
 'Desde el inicio del combate reduces permanentemente la defensa del enemigo.',
 'tactical', 'rare',
 '[{"stat":"intelligence","value":4},{"stat":"agility","value":2}]',
 '{"trigger":"start_of_combat","effect":"enemy_debuff","stat":"defense","value":0.15,"duration":99}',
 '🔻'),

-- Doble ataque ronda 3 (build velocidad)
('Velocidad Letal',
 'En la ronda 3 atacas dos veces con toda tu velocidad.',
 'offensive', 'rare',
 '[{"stat":"agility","value":5},{"stat":"attack","value":5}]',
 '{"trigger":"round_n","n":3,"effect":"double_attack","duration":1}',
 '⚡'),

-- Última línea defensiva (epic defensivo)
('Alma Resistente',
 'Al borde de la muerte tu cuerpo se endurece y reduce a la mitad el daño recibido durante 3 rondas.',
 'defensive', 'epic',
 '[{"stat":"defense","value":8},{"stat":"max_hp","value":20}]',
 '{"trigger":"hp_below_pct","threshold":0.20,"effect":"damage_reduction","value":0.50,"duration":3,"once":true}',
 '💎'),

-- Lifesteal alto (epic ofensivo, más que Vampirismo rare)
('Gran Robo de Vida',
 'Cada golpe drena masivamente la vitalidad del enemigo restaurando el 20% del daño como HP.',
 'offensive', 'epic',
 '[{"stat":"attack","value":7},{"stat":"strength","value":6}]',
 '{"trigger":"passive","effect":"lifesteal","value":0.20,"duration":99}',
 '🧛'),

-- Reflejo alto pasivo (epic defensivo, más que Espejo Arcano rare 15%)
('Escudo de Espinas',
 'Tu armadura refleja pasivamente el 22% del daño recibido de vuelta al atacante.',
 'defensive', 'epic',
 '[{"stat":"defense","value":8},{"stat":"strength","value":5}]',
 '{"trigger":"passive","effect":"reflect_damage","value":0.22,"duration":99}',
 '🌵'),

-- Penetración armadura pasiva (uncommon ofensivo)
('Precisión Mortal',
 'Tus ataques penetran pasivamente la defensa del enemigo.',
 'offensive', 'uncommon',
 '[{"stat":"attack","value":4},{"stat":"agility","value":3}]',
 '{"trigger":"passive","effect":"armor_pen_boost","value":0.10,"duration":99}',
 '🎯');
