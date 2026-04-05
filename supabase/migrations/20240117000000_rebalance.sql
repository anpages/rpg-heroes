-- ─────────────────────────────────────────────────────────────────────────────
-- REBALANCEO DE ECONOMÍA Y EXPEDICIONES
-- ─────────────────────────────────────────────────────────────────────────────
-- Objetivos:
--   1. Reducir tasas de producción ÷5 (misma progresión, números más pequeños)
--   2. Reducir costes de edificios ÷5
--   3. Aumentar duración de expediciones ×6 (idle correcto)
--   4. Ajustar recompensas de expediciones proporcionalmente
--   5. Añadir columna type a dungeons si no existe
--   6. Ajustar valores iniciales para nuevos jugadores
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Añadir columna type a dungeons (si no existe)
ALTER TABLE public.dungeons
  ADD COLUMN IF NOT EXISTS type text;

-- 2. Actualizar dungeons con tipo, duración y recompensas rebalanceadas
UPDATE public.dungeons SET
  type             = 'combat',
  duration_minutes = 30,
  gold_min         = 30,
  gold_max         = 80,
  wood_min         = 10,
  wood_max         = 40,
  mana_min         = 0,
  mana_max         = 5,
  experience_reward = 50
WHERE name = 'Cueva de Goblins';

UPDATE public.dungeons SET
  type             = 'wilderness',
  duration_minutes = 60,
  gold_min         = 50,
  gold_max         = 130,
  wood_min         = 40,
  wood_max         = 100,
  mana_min         = 5,
  mana_max         = 20,
  experience_reward = 100
WHERE name = 'Bosque Oscuro';

UPDATE public.dungeons SET
  type             = 'magic',
  duration_minutes = 120,
  gold_min         = 80,
  gold_max         = 220,
  wood_min         = 15,
  wood_max         = 60,
  mana_min         = 30,
  mana_max         = 90,
  experience_reward = 200
WHERE name = 'Ruinas Encantadas';

UPDATE public.dungeons SET
  type             = 'ancient',
  duration_minutes = 240,
  gold_min         = 250,
  gold_max         = 700,
  wood_min         = 80,
  wood_max         = 250,
  mana_min         = 80,
  mana_max         = 250,
  experience_reward = 600
WHERE name = 'Guarida del Dragón';

-- 3. Actualizar tasas de producción para todos los jugadores existentes
--    Fórmula nueva: gold=(2+goldMine-1)*ratio, wood=(1+lumber-1)*ratio, mana=(1+mana-1)*ratio
UPDATE public.resources r SET
  gold_rate = GREATEST(1, (
    SELECT FLOOR(
      (2 + GREATEST(0, gm.level - 1)) *
      LEAST(1.0, COALESCE(
        (SELECT level::float * 30 FROM public.buildings WHERE player_id = r.player_id AND type = 'energy_nexus') /
        NULLIF((SELECT SUM(level * 10) FROM public.buildings WHERE player_id = r.player_id AND type IN ('gold_mine', 'lumber_mill', 'mana_well')), 0),
        1.0
      ))
    )
    FROM public.buildings gm WHERE gm.player_id = r.player_id AND gm.type = 'gold_mine'
  )),
  wood_rate = GREATEST(1, (
    SELECT FLOOR(
      (1 + GREATEST(0, lm.level - 1)) *
      LEAST(1.0, COALESCE(
        (SELECT level::float * 30 FROM public.buildings WHERE player_id = r.player_id AND type = 'energy_nexus') /
        NULLIF((SELECT SUM(level * 10) FROM public.buildings WHERE player_id = r.player_id AND type IN ('gold_mine', 'lumber_mill', 'mana_well')), 0),
        1.0
      ))
    )
    FROM public.buildings lm WHERE lm.player_id = r.player_id AND lm.type = 'lumber_mill'
  )),
  mana_rate = GREATEST(1, (
    SELECT FLOOR(
      (1 + GREATEST(0, mw.level - 1)) *
      LEAST(1.0, COALESCE(
        (SELECT level::float * 30 FROM public.buildings WHERE player_id = r.player_id AND type = 'energy_nexus') /
        NULLIF((SELECT SUM(level * 10) FROM public.buildings WHERE player_id = r.player_id AND type IN ('gold_mine', 'lumber_mill', 'mana_well')), 0),
        1.0
      ))
    )
    FROM public.buildings mw WHERE mw.player_id = r.player_id AND mw.type = 'mana_well'
  ));

-- 4. Actualizar valores por defecto para nuevos jugadores
ALTER TABLE public.resources
  ALTER COLUMN gold        SET DEFAULT 100,
  ALTER COLUMN wood        SET DEFAULT 60,
  ALTER COLUMN mana        SET DEFAULT 20,
  ALTER COLUMN gold_rate   SET DEFAULT 2,
  ALTER COLUMN wood_rate   SET DEFAULT 1,
  ALTER COLUMN mana_rate   SET DEFAULT 1;
