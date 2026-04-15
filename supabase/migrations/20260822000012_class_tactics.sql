-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 5: Tácticas por clase — catálogo completo con efectos condicionales
-- Añade 'universal' al CHECK de required_class e inserta ~4 tácticas por clase.
-- Efectos condicionales (no solo flat bonuses): on_crit, on_dodge, hp_below_pct,
-- round_n, start_of_combat con efectos contextuales.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Ampliar CHECK para incluir 'universal' ───────────────────────────────────
ALTER TABLE public.tactic_catalog
  DROP CONSTRAINT IF EXISTS tactic_catalog_required_class_check;
ALTER TABLE public.tactic_catalog
  ADD CONSTRAINT tactic_catalog_required_class_check
  CHECK (required_class IN ('caudillo','arcanista','sombra','domador','universal'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- CAUDILLO — Guerrero: fuerza, defensa, HP
-- (Ya existe: Muro Reflejante)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.tactic_catalog
  (name, description, category, rarity, required_class, stat_bonuses, combat_effect, icon)
VALUES

('Grito de Guerra',
 'Al inicio del combate, un rugido devastador aumenta tu daño durante los primeros turnos.',
 'offensive', 'rare', 'caudillo',
 '[{"stat":"strength","value":4}]',
 '{"trigger":"start_of_combat","effect":"damage_mult","value":0.30,"duration":2}',
 '😤'),

('Última Resistencia',
 'Al borde de la muerte, tu cuerpo se refuerza y resiste los golpes con menos daño.',
 'defensive', 'uncommon', 'caudillo',
 '[{"stat":"max_hp","value":18},{"stat":"defense","value":3}]',
 '{"trigger":"hp_below_pct","threshold":0.30,"effect":"damage_reduction","value":0.25,"duration":99,"once":true}',
 '🧱'),

('Escudo Vivo',
 'Al inicio del combate, tu resistencia física crea un escudo que absorbe el 20% de tu HP máximo.',
 'defensive', 'rare', 'caudillo',
 '[{"stat":"defense","value":5}]',
 '{"trigger":"start_of_combat","effect":"absorb_shield","value":0.20,"duration":99}',
 '🛡'),

('Frenético',
 'Al caer en estado crítico, tu furia se desata y tu daño aumenta permanentemente.',
 'offensive', 'epic', 'caudillo',
 '[{"stat":"strength","value":5},{"stat":"attack","value":3}]',
 '{"trigger":"hp_below_pct","threshold":0.25,"effect":"damage_mult","value":0.55,"duration":99,"once":true}',
 '🔥');

-- ═══════════════════════════════════════════════════════════════════════════════
-- SOMBRA — Asesino: agilidad, ataque, defensa
-- (Ya existe: Fusion con las Sombras)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.tactic_catalog
  (name, description, category, rarity, required_class, stat_bonuses, combat_effect, icon)
VALUES

('Paso Fantasmal',
 'Cada vez que esquivas un golpe, tu siguiente ataque es un crítico garantizado.',
 'tactical', 'uncommon', 'sombra',
 '[{"stat":"agility","value":4}]',
 '{"trigger":"on_dodge","effect":"guaranteed_crit_next","duration":1}',
 '👻'),

('Veneno Paralizante',
 'Al inicio del combate, infectas al enemigo con un veneno que lo daña cada turno.',
 'offensive', 'uncommon', 'sombra',
 '[{"stat":"attack","value":3}]',
 '{"trigger":"start_of_combat","effect":"dot_damage","value":0.04,"duration":99}',
 '☠'),

('Instinto de Caza',
 'Cuando tu HP cae por debajo del 35%, tu instinto de supervivencia aumenta drásticamente tu esquiva.',
 'tactical', 'rare', 'sombra',
 '[{"stat":"agility","value":3},{"stat":"defense","value":2}]',
 '{"trigger":"hp_below_pct","threshold":0.35,"effect":"dodge_boost","value":0.30,"duration":99,"once":true}',
 '🎯'),

('Golpe Doble',
 'Cuando asestas un crítico, tu siguiente ataque inflige un 60% más de daño.',
 'offensive', 'epic', 'sombra',
 '[{"stat":"attack","value":5},{"stat":"agility","value":3}]',
 '{"trigger":"on_crit","effect":"damage_mult_next","value":0.60,"duration":1}',
 '⚡');

-- ═══════════════════════════════════════════════════════════════════════════════
-- ARCANISTA — Mago: inteligencia, ataque, HP
-- (Ya existe: Toxina Arcana)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.tactic_catalog
  (name, description, category, rarity, required_class, stat_bonuses, combat_effect, icon)
VALUES

('Explosión Arcana',
 'En el turno 3, liberas una ola de magia concentrada que multiplica tu daño.',
 'offensive', 'rare', 'arcanista',
 '[{"stat":"intelligence","value":5}]',
 '{"trigger":"round_n","n":3,"effect":"damage_mult","value":0.70,"duration":1}',
 '💥'),

('Escudo de Maná',
 'Al inicio del combate, tu maná forma un escudo que absorbe el 20% de tu HP máximo.',
 'defensive', 'uncommon', 'arcanista',
 '[{"stat":"max_hp","value":15}]',
 '{"trigger":"start_of_combat","effect":"absorb_shield","value":0.20,"duration":99}',
 '🔮'),

('Maldición Debilitante',
 'Al inicio del combate, una maldición reduce permanentemente el ataque del enemigo.',
 'tactical', 'rare', 'arcanista',
 '[{"stat":"intelligence","value":4}]',
 '{"trigger":"start_of_combat","effect":"enemy_debuff","stat":"attack","value":0.20,"duration":99}',
 '🌀'),

('Chispa del Caos',
 'Tu aura arcana quema al enemigo pasivamente, causando daño continuo durante todo el combate.',
 'offensive', 'epic', 'arcanista',
 '[{"stat":"intelligence","value":5},{"stat":"attack","value":4}]',
 '{"trigger":"passive","effect":"dot_damage","value":0.05,"duration":99}',
 '⚗');

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOMADOR — Maestro de Bestias: fuerza, agilidad, inteligencia
-- (Sin tácticas de clase previas)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.tactic_catalog
  (name, description, category, rarity, required_class, stat_bonuses, combat_effect, icon)
VALUES

('Llamada Salvaje',
 'Tu vínculo con las bestias te permite robar vida al enemigo en cada golpe.',
 'utility', 'uncommon', 'domador',
 '[{"stat":"agility","value":3}]',
 '{"trigger":"passive","effect":"lifesteal","value":0.12,"duration":99}',
 '🐾'),

('Marca de la Presa',
 'Al inicio del combate, marcas al enemigo debilitando permanentemente su defensa.',
 'tactical', 'uncommon', 'domador',
 '[{"stat":"strength","value":3}]',
 '{"trigger":"start_of_combat","effect":"enemy_debuff","stat":"defense","value":0.15,"duration":99}',
 '🎪'),

('Furia Animal',
 'Cuando tu HP cae por debajo del 40%, la rabia de las bestias aumenta permanentemente tu daño.',
 'offensive', 'rare', 'domador',
 '[{"stat":"strength","value":3},{"stat":"agility","value":2}]',
 '{"trigger":"hp_below_pct","threshold":0.40,"effect":"damage_mult","value":0.35,"duration":99,"once":true}',
 '🐺'),

('Olfato Depredador',
 'Cada golpe crítico despierta tu instinto de caza, curándote un 8% de tu HP máximo.',
 'utility', 'rare', 'domador',
 '[{"stat":"intelligence","value":3}]',
 '{"trigger":"on_crit","effect":"heal_pct","value":0.08,"duration":1}',
 '🦁'),

('Instinto Primordial',
 'Al inicio del combate, entras en modo sigilo: esquivas el primer ataque y el siguiente golpe es crítico.',
 'offensive', 'epic', 'domador',
 '[{"stat":"strength","value":4},{"stat":"agility","value":3},{"stat":"intelligence","value":3}]',
 '{"trigger":"start_of_combat","effect":"stealth","duration":1}',
 '🌿');

-- ═══════════════════════════════════════════════════════════════════════════════
-- UNIVERSAL — Maestro del equilibrio: todos los stats
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public.tactic_catalog
  (name, description, category, rarity, required_class, stat_bonuses, combat_effect, icon)
VALUES

('Adaptación Táctica',
 'Tu versatilidad te permite reducir pasivamente el daño que recibes.',
 'tactical', 'uncommon', 'universal',
 '[{"stat":"attack","value":2},{"stat":"defense","value":2}]',
 '{"trigger":"passive","effect":"damage_reduction","value":0.10,"duration":99}',
 '⚖'),

('Primer Golpe',
 'El primer ataque del combate inflige un 50% más de daño, marcando el ritmo de la batalla.',
 'offensive', 'uncommon', 'universal',
 '[{"stat":"attack","value":3}]',
 '{"trigger":"start_of_combat","effect":"first_hit_mult","value":0.50,"duration":1}',
 '⚔'),

('Resiliencia',
 'Cuando tu HP cae por debajo del 30%, te curas inmediatamente un 20% de tu HP máximo.',
 'defensive', 'rare', 'universal',
 '[{"stat":"max_hp","value":15},{"stat":"defense","value":3}]',
 '{"trigger":"hp_below_pct","threshold":0.30,"effect":"heal_pct","value":0.20,"duration":1,"once":true}',
 '💚'),

('Contraataque',
 'Reflejas pasivamente el 20% del daño recibido de vuelta al atacante.',
 'defensive', 'rare', 'universal',
 '[{"stat":"attack","value":3},{"stat":"defense","value":2}]',
 '{"trigger":"passive","effect":"reflect_damage","value":0.20,"duration":99}',
 '🔄'),

('Maestro del Caos',
 'A partir del turno 2, tus ataques infligen un 40% más de daño durante 3 turnos.',
 'tactical', 'epic', 'universal',
 '[{"stat":"attack","value":3},{"stat":"agility","value":3}]',
 '{"trigger":"round_n","n":2,"effect":"damage_mult","value":0.40,"duration":3}',
 '🌪');
