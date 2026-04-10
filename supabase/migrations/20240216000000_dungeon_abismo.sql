-- Añade "Abismo de las Almas" (crypt, 180 min) — encaja en duración entre
-- Minas de Hierro Oscuro (150 min) y Templo de los Antiguos (210 min).
-- Idempotente: si ya existe una mazmorra con ese nombre, no inserta.

INSERT INTO public.dungeons (
  name,
  description,
  difficulty,
  min_hero_level,
  duration_minutes,
  gold_min,
  gold_max,
  wood_min,
  wood_max,
  mana_min,
  mana_max,
  experience_reward,
  type
)
SELECT
  'Abismo de las Almas',
  'Un abismo sin fondo donde las almas de los condenados vagan sin descanso. Los que se adentran raramente recuerdan el camino de vuelta.',
  7,
  9,
  180,
  150,
  400,
  0,
  0,
  0,
  0,
  350,
  'crypt'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dungeons WHERE name = 'Abismo de las Almas'
);
