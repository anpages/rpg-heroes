-- ─────────────────────────────────────────────────────────────────────────────
-- Desafío semanal de mazmorras
-- ─────────────────────────────────────────────────────────────────────────────
-- Una mazmorra del catálogo se marca cada semana con un modificador aleatorio
-- (más loot, menos duración, más oro, etc.). Se genera de forma lazy: la
-- primera vez que un jugador entra a la sección de expediciones de la semana,
-- el backend crea la fila si no existe.
--
-- week_start: lunes 00:00 UTC de la semana (DATE para que sea único por semana)
-- dungeon_id: la mazmorra marcada como desafío
-- modifier_id: identificador del efecto (definido en api/_weeklyModifier.js)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.weekly_dungeon_modifier (
  week_start  date        PRIMARY KEY,
  dungeon_id  uuid        NOT NULL REFERENCES public.dungeons(id) ON DELETE CASCADE,
  modifier_id text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_dungeon_modifier ENABLE ROW LEVEL SECURITY;

-- Lectura pública para autenticados (la UI necesita saber qué mazmorra está marcada)
CREATE POLICY "weekly_dungeon_modifier: authenticated read"
  ON public.weekly_dungeon_modifier FOR SELECT
  USING (auth.role() = 'authenticated');

-- Solo el service role puede insertar/actualizar (lo hace el backend)
-- No se definen políticas de INSERT/UPDATE/DELETE → RLS bloquea por defecto.
