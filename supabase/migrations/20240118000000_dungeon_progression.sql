-- ─────────────────────────────────────────────────────────────────────────────
-- CORRECCIÓN PROGRESIÓN DE MAZMORRAS
-- ─────────────────────────────────────────────────────────────────────────────
-- Las mazmorras añadidas en 20240109 (Cripta, Minas, Templo) no fueron
-- actualizadas por la migración de rebalanceo 20240117.
-- Resultado: mazmorras de nivel más alto tenían menos duración y XP que las
-- de nivel inferior. Esta migración aplica el ×6 de duración y escala
-- las recompensas para una progresión suave:
--
--   nv1  Cueva de Goblins      →  30 min,  50 XP
--   nv3  Bosque Oscuro         →  60 min, 100 XP
--   nv4  Cripta de los Conde.  →  90 min, 150 XP  ← fix
--   nv5  Ruinas Encantadas     → 120 min, 200 XP
--   nv6  Minas de Hierro Osc.  → 150 min, 280 XP  ← fix
--   nv8  Templo de los Antig.  → 210 min, 420 XP  ← fix
--  nv10  Guarida del Dragón    → 240 min, 600 XP
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.dungeons SET
  duration_minutes  = 90,
  gold_min          = 70,
  gold_max          = 180,
  wood_min          = 30,
  wood_max          = 80,
  mana_min          = 20,
  mana_max          = 60,
  experience_reward = 150
WHERE name = 'Cripta de los Condenados';

UPDATE public.dungeons SET
  duration_minutes  = 150,
  gold_min          = 120,
  gold_max          = 300,
  wood_min          = 50,
  wood_max          = 130,
  mana_min          = 10,
  mana_max          = 30,
  experience_reward = 280
WHERE name = 'Minas de Hierro Oscuro';

UPDATE public.dungeons SET
  duration_minutes  = 210,
  gold_min          = 180,
  gold_max          = 480,
  wood_min          = 50,
  wood_max          = 150,
  mana_min          = 70,
  mana_max          = 200,
  experience_reward = 420
WHERE name = 'Templo de los Antiguos';
