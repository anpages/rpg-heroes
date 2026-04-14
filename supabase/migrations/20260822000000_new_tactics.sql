-- ── Nuevas tácticas: efectos existentes ──────────────────────────────────────

INSERT INTO public.tactic_catalog (name, description, category, rarity, stat_bonuses, combat_effect, icon) VALUES

('Escudo Temprano',
 'Levantas un escudo nada más comenzar el combate.',
 'defensive', 'common',
 '[{"stat":"defense","value":3}]',
 '{"trigger":"start_of_combat","effect":"absorb_shield","value":0.15,"duration":1}',
 '🛡'),

('Esquiva Innata',
 'Tu cuerpo evade instintivamente los golpes.',
 'tactical', 'common',
 '[{"stat":"agility","value":4}]',
 '{"trigger":"passive","effect":"dodge_boost","value":0.10}',
 '🌀'),

('Encadenamiento',
 'Un critico garantiza el siguiente.',
 'offensive', 'uncommon',
 '[{"stat":"attack","value":3},{"stat":"agility","value":2}]',
 '{"trigger":"on_crit","effect":"guaranteed_crit_next"}',
 '⛓'),

('Armadura de Crisis',
 'Al inicio reduces el daño que recibes.',
 'defensive', 'uncommon',
 '[{"stat":"defense","value":4},{"stat":"max_hp","value":5}]',
 '{"trigger":"start_of_combat","effect":"damage_reduction","value":0.15,"duration":2}',
 '🧱'),

('Agonia',
 'Al borde de la muerte, golpeas con furia extrema.',
 'offensive', 'epic',
 '[{"stat":"strength","value":6},{"stat":"attack","value":4}]',
 '{"trigger":"hp_below_pct","threshold":0.20,"effect":"damage_mult","value":1.80,"duration":99,"once":true}',
 '😤');

-- ── Nuevas tácticas: efectos nuevos ──────────────────────────────────────────

INSERT INTO public.tactic_catalog (name, description, category, rarity, stat_bonuses, combat_effect, icon) VALUES

('Vampirismo',
 'Cada golpe roba vida al enemigo.',
 'offensive', 'rare',
 '[{"stat":"attack","value":3},{"stat":"strength","value":2}]',
 '{"trigger":"passive","effect":"lifesteal","value":0.12}',
 '🧛'),

('Envenenamiento',
 'Al inicio del combate, envenas al enemigo.',
 'tactical', 'uncommon',
 '[{"stat":"intelligence","value":3}]',
 '{"trigger":"start_of_combat","effect":"dot_damage","value":0.04,"duration":4}',
 '☠'),

('Espejo Arcano',
 'Reflejas parte del daño recibido al atacante.',
 'defensive', 'rare',
 '[{"stat":"defense","value":3},{"stat":"intelligence","value":2}]',
 '{"trigger":"passive","effect":"reflect_damage","value":0.15}',
 '🪞'),

('Corrosion',
 'Debilitas la armadura del rival en ronda 2.',
 'tactical', 'rare',
 '[{"stat":"intelligence","value":4},{"stat":"agility","value":2}]',
 '{"trigger":"round_n","n":2,"effect":"enemy_debuff","stat":"defense","value":0.20,"duration":3}',
 '🧪');

-- ── Tácticas exclusivas de clase: efectos nuevos ──────────────────────────────

INSERT INTO public.tactic_catalog (name, description, category, rarity, required_class, stat_bonuses, combat_effect, icon) VALUES

-- ARCANISTA
('Toxina Arcana',
 'Tu magia envenena al enemigo durante todo el combate.',
 'offensive', 'rare', 'arcanista',
 '[{"stat":"intelligence","value":6}]',
 '{"trigger":"start_of_combat","effect":"dot_damage","value":0.05,"duration":99}',
 '⚗'),

-- SOMBRA
('Fusion con las Sombras',
 'Te fundes con la oscuridad, absorbiendo la vida de tus victimas.',
 'offensive', 'epic', 'sombra',
 '[{"stat":"agility","value":5},{"stat":"attack","value":4}]',
 '{"trigger":"passive","effect":"lifesteal","value":0.22}',
 '🌒'),

-- CAUDILLO
('Muro Reflejante',
 'Tu armadura devuelve los golpes al atacante.',
 'defensive', 'epic', 'caudillo',
 '[{"stat":"defense","value":7},{"stat":"max_hp","value":10}]',
 '{"trigger":"start_of_combat","effect":"reflect_damage","value":0.20,"duration":5}',
 '🗿');
