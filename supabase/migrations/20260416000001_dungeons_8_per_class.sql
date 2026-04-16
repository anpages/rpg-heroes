-- ─────────────────────────────────────────────────────────────────────────────
-- 8 mazmorras por clase — progresión completa con acceso a esencia garantizado
-- Duraciones: 15, 25, 40, 60, 90, 120, 180, 240 min
-- Niveles req.: 1, 1, 3, 6, 9, 13, 17, 22
-- Esencia (tipo ancient): Caudillo/Sombra desde d6; Arcanista/Domador desde d3
-- ─────────────────────────────────────────────────────────────────────────────

-- Limpiar expediciones activas antes de borrar mazmorras
DELETE FROM public.expeditions;

-- Borrar todas las mazmorras actuales
DELETE FROM public.dungeons;

-- ── CAUDILLO — combate frontal, fuerza bruta ──────────────────────────────────
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Colina Asediada',
   'Tropas enemigas han tomado una colina estratégica. Recupera el terreno.',
   'combat', 'caudillo', 1, 1, 15, 15, 35, 0, 0, 0, 0, 40),
  ('Paso Fortificado',
   'Un paso de montaña tomado por mercenarios. Abre el camino a la fuerza.',
   'combat', 'caudillo', 2, 1, 25, 22, 48, 0, 0, 0, 0, 58),
  ('Fortaleza en Ruinas',
   'Una fortaleza abandonada esconde saqueadores armados. Límpiala.',
   'crypt', 'caudillo', 3, 3, 40, 32, 65, 0, 0, 0, 0, 85),
  ('Baluarte del Norte',
   'Un baluarte fronterizo ha caído en manos de guerreros bárbaros.',
   'combat', 'caudillo', 4, 6, 60, 50, 100, 0, 0, 0, 0, 130),
  ('Catacumbas del Conquistador',
   'Bajo las ruinas de una antigua capital, los muertos guardan sus secretos.',
   'crypt', 'caudillo', 5, 9, 90, 75, 145, 0, 0, 0, 0, 195),
  ('Templo del Héroe Caído',
   'Un templo erigido en honor a un guerrero legendario, ahora mancillado.',
   'ancient', 'caudillo', 6, 13, 120, 100, 190, 0, 0, 0, 0, 270),
  ('Gran Ciudadela',
   'La mayor fortaleza del reino, asediada por un ejército sin nombre.',
   'combat', 'caudillo', 7, 17, 180, 150, 270, 0, 0, 0, 0, 380),
  ('Ciudadela del Conquistador',
   'La ciudadela legendaria del Conquistador Eterno aguarda un digno rival.',
   'ancient', 'caudillo', 8, 22, 240, 210, 360, 0, 0, 0, 0, 520);

-- ── SOMBRA — sigilo, trampas, mundo subterráneo ───────────────────────────────
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Callejones Malditos',
   'Una red de callejones donde prospera el crimen. Infiltrate y elimina a sus líderes.',
   'wilderness', 'sombra', 1, 1, 15, 15, 35, 0, 0, 0, 0, 40),
  ('Mercado Negro',
   'Un mercado clandestino donde todo tiene precio, incluidas las vidas.',
   'wilderness', 'sombra', 2, 1, 25, 22, 48, 0, 0, 0, 0, 58),
  ('Guarida de los Ladrones',
   'Una mina abandonada convertida en cuartel de una banda de asesinos.',
   'mine', 'sombra', 3, 3, 40, 32, 65, 0, 0, 0, 0, 85),
  ('Barrios Subterráneos',
   'Un laberinto de túneles bajo la ciudad donde viven proscriptos y espías.',
   'wilderness', 'sombra', 4, 6, 60, 50, 100, 0, 0, 0, 0, 130),
  ('Minas Profundas',
   'Galerías excavadas sin mapa que esconden tanto mineral como peligro.',
   'mine', 'sombra', 5, 9, 90, 75, 145, 0, 0, 0, 0, 195),
  ('Cripta del Asesino',
   'La tumba sellada del primer maestro asesino, guardada por sus discípulos no-muertos.',
   'ancient', 'sombra', 6, 13, 120, 100, 190, 0, 0, 0, 0, 270),
  ('Red de los Proscriptos',
   'Una organización criminal que opera desde los rincones más oscuros del mundo.',
   'wilderness', 'sombra', 7, 17, 180, 150, 270, 0, 0, 0, 0, 380),
  ('Red de Asesinos',
   'La organización de asesinos más temida opera desde estas catacumbas malditas.',
   'ancient', 'sombra', 8, 22, 240, 210, 360, 0, 0, 0, 0, 520);

-- ── ARCANISTA — magia, ruinas arcanas, conocimiento prohibido ─────────────────
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Biblioteca Prohibida',
   'Manuscritos malditos cobran vida y custodian sus secretos.',
   'magic', 'arcanista', 1, 1, 15, 15, 35, 0, 0, 0, 0, 40),
  ('Laboratorio Arcano',
   'El laboratorio de un alquimista demente rebosa de experimentos inestables.',
   'magic', 'arcanista', 2, 1, 25, 22, 48, 0, 0, 0, 0, 58),
  ('Torre del Mago',
   'La torre de un archimago que buscó la inmortalidad y encontró la maldición.',
   'ancient', 'arcanista', 3, 3, 40, 32, 65, 0, 0, 0, 0, 85),
  ('Nexo Arcano',
   'Un nodo de maná donde convergen ríos de energía primordial descontrolada.',
   'magic', 'arcanista', 4, 6, 60, 50, 100, 0, 0, 0, 0, 130),
  ('Ruinas del Archimago',
   'Lo que queda de la academia del archimago más poderoso que existió.',
   'ancient', 'arcanista', 5, 9, 90, 75, 145, 0, 0, 0, 0, 195),
  ('Vacío Dimensional',
   'Una grieta entre planos donde la realidad se dobla y los hechizos mutan.',
   'magic', 'arcanista', 6, 13, 120, 100, 190, 0, 0, 0, 0, 270),
  ('Templo de los Arcanos',
   'El último templo de los Arcanos Eternos, sellado por siglos de olvido.',
   'ancient', 'arcanista', 7, 17, 180, 150, 270, 0, 0, 0, 0, 380),
  ('Santuario de los Arcanos',
   'El sanctasanctórum donde los primeros arcanistas sellaron su legado maldito.',
   'ancient', 'arcanista', 8, 22, 240, 210, 360, 0, 0, 0, 0, 520);

-- ── DOMADOR — naturaleza, bestias, territorios salvajes ───────────────────────
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Bosque Salvaje',
   'Una arboleda donde las bestias han perdido el miedo a los humanos.',
   'wilderness', 'domador', 1, 1, 15, 15, 35, 0, 0, 0, 0, 40),
  ('Pradera de las Fieras',
   'Llanuras dominadas por manadas de criaturas que no conocen amo.',
   'wilderness', 'domador', 2, 1, 25, 22, 48, 0, 0, 0, 0, 58),
  ('Cueva de las Bestias',
   'Una caverna donde duermen criaturas despertadas por una maldición antigua.',
   'ancient', 'domador', 3, 3, 40, 32, 65, 0, 0, 0, 0, 85),
  ('Jungla Encantada',
   'Una jungla donde la flora y la fauna están bajo el influjo de una fuerza oscura.',
   'wilderness', 'domador', 4, 6, 60, 50, 100, 0, 0, 0, 0, 130),
  ('Guarida del Dragón',
   'La caverna de un dragón anciano cuya presencia ha corrompido el entorno.',
   'ancient', 'domador', 5, 9, 90, 75, 145, 0, 0, 0, 0, 195),
  ('Valle Maldito',
   'Un valle donde los animales mueren sin causa aparente y algo más los sustituye.',
   'wilderness', 'domador', 6, 13, 120, 100, 190, 0, 0, 0, 0, 270),
  ('Árbol Corrompido',
   'El árbol sagrado más antiguo ha sido corrompido y sus guardianes con él.',
   'ancient', 'domador', 7, 17, 180, 150, 270, 0, 0, 0, 0, 380),
  ('Árbol del Mundo',
   'El árbol que conecta los planos ha sido mancillado. Purifícalo o perece.',
   'ancient', 'domador', 8, 22, 240, 210, 360, 0, 0, 0, 0, 520);

-- ── UNIVERSAL — endgame, todas las clases ─────────────────────────────────────
INSERT INTO public.dungeons
  (name, description, type, required_class, difficulty, min_hero_level,
   duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward)
VALUES
  ('Bosque Oscuro',
   'Un bosque donde la luz no llega y los peligros acechan desde las sombras.',
   'wilderness', 'universal', 1, 1, 20, 18, 40, 0, 0, 0, 0, 50),
  ('Campamento Bandido',
   'Un campamento bien organizado de bandidos que amenaza las rutas comerciales.',
   'combat', 'universal', 2, 1, 30, 28, 60, 0, 0, 0, 0, 75),
  ('Mina Abismal',
   'Una mina sin fondo donde los minerales brillan con luz propia y el peligro acecha.',
   'mine', 'universal', 3, 3, 45, 38, 78, 0, 0, 0, 0, 105),
  ('Catacumbas Profundas',
   'Un laberinto de catacumbas que se extiende kilómetros bajo tierra.',
   'crypt', 'universal', 4, 5, 60, 50, 100, 0, 0, 0, 0, 130),
  ('Fortaleza del Caos',
   'Una fortaleza tomada por fuerzas que no deberían existir en este plano.',
   'combat', 'universal', 5, 8, 90, 75, 145, 0, 0, 0, 0, 195),
  ('Santuario Eterno',
   'Un templo fuera del tiempo donde los guardianes antiguos no descansan.',
   'ancient', 'universal', 6, 10, 120, 100, 190, 0, 0, 0, 0, 270),
  ('Templo del Fin del Mundo',
   'Un templo erigido en honor a la destrucción, donde el caos es venerado.',
   'ancient', 'universal', 7, 15, 180, 150, 270, 0, 0, 0, 0, 380),
  ('Corazón del Caos',
   'El núcleo de la corrupción que amenaza el mundo. Solo los más fuertes sobreviven.',
   'combat', 'universal', 8, 20, 240, 210, 360, 0, 0, 0, 0, 520);
