-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 4: Mazmorras específicas por clase
-- Añade required_class a dungeons, elimina mazmorras genéricas e inserta
-- 4 mazmorras por clase (caudillo, sombra, arcanista, domador, universal).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Columna required_class ───────────────────────────────────────────────────
ALTER TABLE public.dungeons
  ADD COLUMN IF NOT EXISTS required_class text
  REFERENCES public.classes(id);

-- ── Limpiar expediciones activas antes de borrar mazmorras ───────────────────
-- Las expediciones referenciaban dungeons; las borramos para evitar FK error.
DELETE FROM public.expeditions;

-- ── Eliminar mazmorras genéricas ─────────────────────────────────────────────
DELETE FROM public.dungeons;

-- ── Mazmorras por clase ───────────────────────────────────────────────────────
-- Columnas: name, description, type, required_class, difficulty, min_hero_level,
--           duration_minutes, gold_min, gold_max, wood_min, wood_max,
--           mana_min, mana_max, experience_reward
-- (wood/mana_min/max son 0: recursos pasivos solo de edificios)

-- CAUDILLO — combate frontal, fuerza bruta
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Colina Asediada',
   'Tropas enemigas han tomado una colina estratégica. Recupera el terreno.',
   'combat', 'caudillo', 2, 1, 15, 15, 35, 0, 0, 0, 0, 40),
  ('Fortaleza en Ruinas',
   'Una fortaleza abandonada esconde saqueadores armados. Límpiala.',
   'crypt', 'caudillo', 4, 3, 30, 30, 60, 0, 0, 0, 0, 80),
  ('Baluarte del Norte',
   'Un baluarte fronterizo ha caído en manos de guerreros bárbaros.',
   'combat', 'caudillo', 6, 6, 60, 55, 100, 0, 0, 0, 0, 140),
  ('Ciudadela del Conquistador',
   'La ciudadela legendaria del Conquistador Eterno aguarda un digno rival.',
   'crypt', 'caudillo', 8, 10, 90, 90, 160, 0, 0, 0, 0, 250);

-- SOMBRA — sigilo, trampas, mundo subterráneo
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Callejones Malditos',
   'Una red de callejones donde prospera el crimen. Infiltrate y elimina a sus líderes.',
   'wilderness', 'sombra', 2, 1, 15, 15, 35, 0, 0, 0, 0, 40),
  ('Guarida de los Ladrones',
   'Una mina abandonada convertida en cuartel de una banda de asesinos.',
   'mine', 'sombra', 4, 3, 30, 30, 60, 0, 0, 0, 0, 80),
  ('Barrios Subterráneos',
   'Un laberinto de túneles bajo la ciudad donde viven proscriptos y espías.',
   'wilderness', 'sombra', 6, 6, 60, 55, 100, 0, 0, 0, 0, 140),
  ('Red de Asesinos',
   'La organización de asesinos más temida opera desde estas catacumbas.',
   'mine', 'sombra', 8, 10, 90, 90, 160, 0, 0, 0, 0, 250);

-- ARCANISTA — magia, ruinas arcanas, conocimiento prohibido
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Biblioteca Prohibida',
   'Manuscritos malditos cobran vida y custodian sus secretos.',
   'magic', 'arcanista', 2, 1, 15, 15, 35, 0, 0, 0, 0, 40),
  ('Torre del Mago',
   'La torre de un archimago demente rebosa de experimentos fallidos.',
   'ancient', 'arcanista', 4, 3, 30, 30, 60, 0, 0, 0, 0, 80),
  ('Nexo Arcano',
   'Un nodo de maná donde convergen ríos de energía primordial descontrolada.',
   'magic', 'arcanista', 6, 6, 60, 55, 100, 0, 0, 0, 0, 140),
  ('Santuario de los Arcanos',
   'El último santuario de los Arcanos Eternos, sellado por siglos de olvido.',
   'ancient', 'arcanista', 8, 10, 90, 90, 160, 0, 0, 0, 0, 250);

-- DOMADOR — naturaleza, bestias, territorios salvajes
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Bosque Salvaje',
   'Una arboleda donde las bestias han perdido el miedo a los humanos.',
   'wilderness', 'domador', 2, 1, 15, 15, 35, 0, 0, 0, 0, 40),
  ('Cueva de las Bestias',
   'Una caverna donde duermen criaturas despertadas por una maldición antigua.',
   'ancient', 'domador', 4, 3, 30, 30, 60, 0, 0, 0, 0, 80),
  ('Jungla Encantada',
   'Una jungla donde la flora y la fauna están bajo el influjo de una fuerza oscura.',
   'wilderness', 'domador', 6, 6, 60, 55, 100, 0, 0, 0, 0, 140),
  ('Árbol del Mundo',
   'El árbol sagrado que conecta los planos ha sido corrompido. Purifícalo.',
   'ancient', 'domador', 8, 10, 90, 90, 160, 0, 0, 0, 0, 250);

-- UNIVERSAL — endgame, todas las clases
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Mina Abismal',
   'Una mina sin fondo donde los minerales brillan con luz propia y el peligro acecha.',
   'mine', 'universal', 4, 1, 30, 30, 60, 0, 0, 0, 0, 80),
  ('Catacumbas Profundas',
   'Un laberinto de catacumbas que se extiende kilómetros bajo tierra.',
   'crypt', 'universal', 6, 5, 60, 55, 100, 0, 0, 0, 0, 140),
  ('Santuario Eterno',
   'Un templo fuera del tiempo donde los guardianes antiguos no descansan.',
   'ancient', 'universal', 8, 10, 90, 90, 160, 0, 0, 0, 0, 250),
  ('Corazón del Caos',
   'El núcleo de la corrupción que amenaza el mundo. Solo los más fuertes sobreviven.',
   'combat', 'universal', 10, 15, 120, 150, 250, 0, 0, 0, 0, 400);
