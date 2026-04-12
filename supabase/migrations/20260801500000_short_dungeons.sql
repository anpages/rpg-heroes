-- ─────────────────────────────────────────────────────────────────────────────
-- MAZMORRAS RAPIDAS (10-20 min)
-- Cubren el nicho de contenido corto que antes ocupaban las camaras.
-- Recompensas reducidas pero enfocadas en un tipo de loot concreto.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.dungeons (name, description, difficulty, min_hero_level, duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward, type)
SELECT * FROM (VALUES
  (
    'Sendero del Bosque',
    'Un camino forestal plagado de bestias menores. Ideal para entrenar y encontrar equipo ligero.',
    1, 1, 10,
    8, 20, 0, 0, 0, 0,
    10,
    'wilderness'
  ),
  (
    'Mina Abandonada',
    'Vetas agotadas y tuneles inestables. Los mineros dejaron atras mas de lo que creen.',
    2, 2, 12,
    12, 30, 0, 0, 0, 0,
    15,
    'mine'
  ),
  (
    'Altar Corrompido',
    'Un santuario profanado donde la magia residual atrae criaturas arcanas. Fuente de conocimiento tactico.',
    3, 3, 15,
    15, 40, 0, 0, 0, 0,
    20,
    'magic'
  ),
  (
    'Catacumba Olvidada',
    'Pasadizos estrechos llenos de no-muertos menores. Buen lugar para encontrar escudos y armaduras antiguas.',
    4, 5, 18,
    20, 50, 0, 0, 0, 0,
    30,
    'crypt'
  ),
  (
    'Veta Arcana',
    'Una fisura en la realidad que emana energia pura. Los fragmentos de esencia se cristalizan en sus paredes.',
    5, 7, 20,
    25, 60, 0, 0, 0, 0,
    40,
    'ancient'
  )
) AS v(name, description, difficulty, min_hero_level, duration_minutes, gold_min, gold_max, wood_min, wood_max, mana_min, mana_max, experience_reward, type)
WHERE NOT EXISTS (SELECT 1 FROM public.dungeons d WHERE d.name = v.name);
