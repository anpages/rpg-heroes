-- Cartas de habilidad: categorías Ataque y Defensa
-- Budget: attack cards usa hero.attack como límite de presupuesto
--         defense cards usa hero.defense como límite de presupuesto

INSERT INTO skill_cards (name, description, category, rarity, base_cost, base_mana_fuse,
  attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus)
VALUES
  -- ── ATTACK (7 cartas) ───────────────────────────────────────────────────────
  ('Filo Afilado',      'Un filo perfectamente afilado que aumenta el daño bruto.',
   'attack', 'common',    1,  10,  3, 0,  0, 0, 0, 0),

  ('Golpe Certero',     'Precisión en cada golpe, combinando fuerza y velocidad.',
   'attack', 'common',    1,  10,  2, 0,  0, 0, 1, 0),

  ('Emboscada',         'Aprovechar el primer instante del combate para golpear con ventaja.',
   'attack', 'uncommon',  2,  25,  5, 0,  0, 0, 0, 0),

  ('Arma Forjada',      'Un arma con mejor temple que amplifica cada golpe del portador.',
   'attack', 'uncommon',  2,  25,  4, 0,  0, 1, 0, 0),

  ('Tajo Letal',        'Un corte devastador que ignora parte de la resistencia del enemigo.',
   'attack', 'rare',      3,  60,  8, 0,  0, 0, 0, 0),

  ('Furia Imparable',   'La rabia en combate se convierte en un torrente de golpes implacables.',
   'attack', 'epic',      4, 120, 12, 0,  0, 2, 0, 0),

  ('Destructor',        'El epítome de la destrucción ofensiva: cada golpe resuena como un trueno.',
   'attack', 'legendary', 5, 200, 18, 0,  0, 3, 0, 0),

  -- ── DEFENSE (7 cartas) ──────────────────────────────────────────────────────
  ('Guardia Firme',     'Una postura defensiva que reduce el daño recibido.',
   'defense', 'common',    1,  10,  0, 2,  0, 0, 0, 0),

  ('Postura Defensiva', 'Sacrificar movilidad para absorber mejor los impactos.',
   'defense', 'common',    1,  10,  0, 1,  8, 0, 0, 0),

  ('Muralla de Escudos','Una técnica de escudo que convierte al portador en un bastión móvil.',
   'defense', 'uncommon',  2,  25,  0, 4,  0, 0, 0, 0),

  ('Tenacidad',         'La voluntad de resistir convierte cada golpe en una prueba superada.',
   'defense', 'uncommon',  2,  25,  0, 3, 15, 0, 0, 0),

  ('Bastión',           'El portador se convierte en una fortaleza viviente en el campo de batalla.',
   'defense', 'rare',      3,  60,  0, 6, 20, 0, 0, 0),

  ('Corazón de Piedra', 'Un espíritu irrompible que endurece el cuerpo hasta hacerlo casi impenetrable.',
   'defense', 'epic',      4, 120,  0, 9, 35, 0, 0, 0),

  ('Égida',             'La protección definitiva: una barrera que hace inútiles los ataques más poderosos.',
   'defense', 'legendary', 5, 200,  0,14, 50, 0, 0, 0);
