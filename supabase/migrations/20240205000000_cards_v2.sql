-- ─── Cards v2: nuevo schema con bonuses/penalties como JSONB ─────────────────

-- 1. Añadir nuevas columnas + hacer category nullable para v2
ALTER TABLE public.skill_cards
  ADD COLUMN IF NOT EXISTS card_category text,
  ADD COLUMN IF NOT EXISTS bonuses       jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS penalties     jsonb DEFAULT '[]';

ALTER TABLE public.skill_cards ALTER COLUMN category  DROP NOT NULL;
ALTER TABLE public.skill_cards ALTER COLUMN category  SET DEFAULT 'v2';
ALTER TABLE public.skill_cards ALTER COLUMN rarity    DROP NOT NULL;
ALTER TABLE public.skill_cards ALTER COLUMN rarity    SET DEFAULT 'common';
ALTER TABLE public.skill_cards ALTER COLUMN base_cost DROP NOT NULL;
ALTER TABLE public.skill_cards ALTER COLUMN base_cost SET DEFAULT 0;
ALTER TABLE public.skill_cards ALTER COLUMN base_mana_fuse DROP NOT NULL;
ALTER TABLE public.skill_cards ALTER COLUMN base_mana_fuse SET DEFAULT 0;

-- 2. Limpiar datos de debug y cartas viejas
DELETE FROM public.hero_cards;
DELETE FROM public.skill_cards;

-- 3. Insertar las 28 cartas v2

-- ── Ofensa ──────────────────────────────────────────────────────────────────
INSERT INTO public.skill_cards (name, card_category, bonuses, penalties, description) VALUES
('Berserker',  'offense',
  '[{"stat":"attack","value":10}]',
  '[{"stat":"defense","value":7}]',
  'La ira lo es todo. Golpea más fuerte, pero olvida protegerse.'),

('Asesino',    'offense',
  '[{"stat":"attack","value":12}]',
  '[{"stat":"intelligence","value":8}]',
  'Letal y preciso. Cada pensamiento desperdiciado en estrategia es un golpe que no llega.'),

('Duelista',   'offense',
  '[{"stat":"attack","value":8}]',
  '[{"stat":"strength","value":6}]',
  'La velocidad del filo importa más que la fuerza del brazo.'),

('Espadachín', 'offense',
  '[{"stat":"attack","value":8}]',
  '[{"stat":"agility","value":6}]',
  'Maestro de la espada, pero su postura firme sacrifica la movilidad.'),

('Bruto',      'offense',
  '[{"stat":"strength","value":10}]',
  '[{"stat":"agility","value":7}]',
  'Músculo puro. Se mueve como una roca: lento, pero imparable.'),

('Luchador',   'offense',
  '[{"stat":"strength","value":10}]',
  '[{"stat":"intelligence","value":7}]',
  'Lucha con el instinto, no con la cabeza. Funciona.'),

('Guerrero',   'offense',
  '[{"stat":"attack","value":6},{"stat":"strength","value":5}]',
  '[{"stat":"defense","value":8}]',
  'Equilibrio entre fuerza y precisión. Ataca en todas direcciones, pero descuida el escudo.');

-- ── Resistencia ─────────────────────────────────────────────────────────────
INSERT INTO public.skill_cards (name, card_category, bonuses, penalties, description) VALUES
('Escudo',     'defense',
  '[{"stat":"defense","value":10}]',
  '[{"stat":"attack","value":7}]',
  'El escudo lo es todo. Quien solo defiende, tarde o temprano gana.'),

('Centinela',  'defense',
  '[{"stat":"defense","value":10}]',
  '[{"stat":"agility","value":7}]',
  'Plantado como un árbol. Nada lo mueve, pero tampoco puede moverse él.'),

('Guardián',   'defense',
  '[{"stat":"defense","value":8}]',
  '[{"stat":"strength","value":6}]',
  'Protege a los suyos. La fuerza bruta no tiene cabida en su técnica.'),

('Titán',      'defense',
  '[{"stat":"max_hp","value":25}]',
  '[{"stat":"agility","value":7}]',
  'Más carne, más vida. Difícil de matar, imposible de correr.'),

('Baluarte',   'defense',
  '[{"stat":"max_hp","value":25}]',
  '[{"stat":"intelligence","value":7}]',
  'Su cuerpo es la fortaleza. No necesita pensar, solo resistir.'),

('Montaña',    'defense',
  '[{"stat":"max_hp","value":35}]',
  '[{"stat":"attack","value":8},{"stat":"agility","value":5}]',
  'Inamovible. Paga con velocidad y filo, pero casi no puede morir.');

-- ── Movilidad / Mente ────────────────────────────────────────────────────────
INSERT INTO public.skill_cards (name, card_category, bonuses, penalties, description) VALUES
('Explorador', 'mobility',
  '[{"stat":"agility","value":10}]',
  '[{"stat":"max_hp","value":20}]',
  'Ligero como el viento. Tan ligero que cualquier golpe lo tumba.'),

('Acróbata',   'mobility',
  '[{"stat":"agility","value":10}]',
  '[{"stat":"defense","value":7}]',
  'Esquiva en lugar de bloquear. Si no te golpean, no necesitas armadura.'),

('Rastreador', 'mobility',
  '[{"stat":"agility","value":8}]',
  '[{"stat":"strength","value":6}]',
  'Persigue, flanquea, escapa. La fuerza no es su camino.'),

('Sabio',      'mobility',
  '[{"stat":"intelligence","value":10}]',
  '[{"stat":"strength","value":7}]',
  'La mente es el arma más afilada. El cuerpo, solo su vehículo.'),

('Oráculo',    'mobility',
  '[{"stat":"intelligence","value":10}]',
  '[{"stat":"defense","value":7}]',
  'Ve el golpe antes de que llegue. Predecir no es lo mismo que parar.'),

('Erudito',    'mobility',
  '[{"stat":"intelligence","value":8}]',
  '[{"stat":"agility","value":6}]',
  'Estudia cada movimiento. Pensar demasiado a veces cuesta un paso.');

-- ── Equipo ───────────────────────────────────────────────────────────────────
INSERT INTO public.skill_cards (name, card_category, bonuses, penalties, description) VALUES
('Filo Afilado',       'equipment',
  '[{"stat":"weapon_attack_amp","value":0.15}]',
  '[{"stat":"agility","value":8}]',
  'El arma corta el aire antes de llegar al enemigo. Pero moverse con ella cuesta.'),

('Armadura Reforzada', 'equipment',
  '[{"stat":"armor_defense_amp","value":0.15}]',
  '[{"stat":"attack","value":7}]',
  'Cada placa reforzada añade protección y peso. El brazo de ataque paga el precio.'),

('Herrero',            'equipment',
  '[{"stat":"durability_loss","value":-2}]',
  '[{"stat":"attack","value":6}]',
  'Cuida el equipo como nadie. Cada golpe dado desgasta menos, pero con menos fuerza.'),

('Destrozador',        'equipment',
  '[{"stat":"attack","value":14}]',
  '[{"stat":"durability_loss","value":2}]',
  'Golpea con todo. El arma paga el precio de tanta brutalidad.'),

('Saqueador',          'equipment',
  '[{"stat":"item_drop_rate","value":0.05}]',
  '[{"stat":"defense","value":7}]',
  'Siempre encuentra algo de valor. Prefiere rebuscar a cubrirse.');

-- ── Híbridas ────────────────────────────────────────────────────────────────
INSERT INTO public.skill_cards (name, card_category, bonuses, penalties, description) VALUES
('Paladín',    'hybrid',
  '[{"stat":"defense","value":8},{"stat":"max_hp","value":15}]',
  '[{"stat":"attack","value":8},{"stat":"agility","value":5}]',
  'Fe y acero. Protege y aguanta, pero no es el más rápido ni el más letal.'),

('Ranger',     'hybrid',
  '[{"stat":"agility","value":8},{"stat":"intelligence","value":7}]',
  '[{"stat":"strength","value":7},{"stat":"max_hp","value":15}]',
  'Veloz y astuto. Su cuerpo es ligero, quizás demasiado.'),

('Archimago',  'hybrid',
  '[{"stat":"intelligence","value":14}]',
  '[{"stat":"defense","value":10},{"stat":"strength","value":7}]',
  'Poder arcano sin igual. Su cuerpo es casi un accesorio.'),

('Kamikaze',   'hybrid',
  '[{"stat":"attack","value":12},{"stat":"strength","value":8}]',
  '[{"stat":"defense","value":10},{"stat":"max_hp","value":20}]',
  'Destruye todo lo que toca. Incluyéndose a sí mismo.');
