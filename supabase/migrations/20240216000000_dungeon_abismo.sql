-- Añade "Abismo de las Almas" (crypt, 180 min) para completar la progresión par de mazmorras.
-- Encaja entre Minas de Hierro Oscuro (150 min) y Templo de los Antiguos (210 min).

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
) VALUES (
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
);
