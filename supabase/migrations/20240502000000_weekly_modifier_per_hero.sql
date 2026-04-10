-- ─────────────────────────────────────────────────────────────────────────────
-- Desafío semanal per-héroe
-- ─────────────────────────────────────────────────────────────────────────────
-- La versión inicial (20240501) usaba una fila por semana, global. Eso provocaba
-- dos problemas:
--   1. Las mazmorras se filtran por nivel del héroe, no del jugador, por lo que
--      un solo modificador global no podía adaptarse al progreso de cada héroe.
--   2. Si la mazmorra elegida estaba bloqueada, la semana era inservible.
--
-- Solución: cada héroe tiene su propio desafío de la semana. PK compuesta
-- (week_start, hero_id), y al generarlo se filtran las dungeons por
-- min_hero_level <= hero.level.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop seguro de la tabla anterior (sin datos relevantes en producción aún)
DROP TABLE IF EXISTS public.weekly_dungeon_modifier;

CREATE TABLE public.weekly_dungeon_modifier (
  week_start  date        NOT NULL,
  hero_id     uuid        NOT NULL REFERENCES public.heroes(id)   ON DELETE CASCADE,
  dungeon_id  uuid        NOT NULL REFERENCES public.dungeons(id) ON DELETE CASCADE,
  modifier_id text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (week_start, hero_id)
);

CREATE INDEX weekly_dungeon_modifier_hero_idx
  ON public.weekly_dungeon_modifier (hero_id);

ALTER TABLE public.weekly_dungeon_modifier ENABLE ROW LEVEL SECURITY;

-- Lectura para autenticados (la UI necesita saber qué mazmorra está marcada)
CREATE POLICY "weekly_dungeon_modifier: authenticated read"
  ON public.weekly_dungeon_modifier FOR SELECT
  USING (auth.role() = 'authenticated');

-- Sin políticas de INSERT/UPDATE/DELETE → solo el service role escribe (backend).
