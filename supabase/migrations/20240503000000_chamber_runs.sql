-- ─────────────────────────────────────────────────────────────────────────────
-- Cámaras: incursiones rápidas con coste alto de HP y decisión al recoger
-- ─────────────────────────────────────────────────────────────────────────────
-- Las Cámaras son una variante "snack" de las expediciones:
--   • duran 3-10 minutos (frente a las 4h de una expedición)
--   • cuestan ~20% del max_hp del héroe al iniciar (limitador real)
--   • al recoger, se ofrecen 3 cofres firmados con HMAC y el jugador elige uno
--   • dan menos loot raro/cartas que una expedición — son complementarias
--
-- Slot independiente del de expediciones (no bloquean ni se bloquean).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.chamber_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id      uuid NOT NULL REFERENCES public.heroes(id) ON DELETE CASCADE,
  chamber_type text NOT NULL,                          -- 'mercader' | 'erudito' | 'cazador' | 'mixta'
  difficulty   integer NOT NULL DEFAULT 1,             -- 1-10, escala con el nivel del héroe
  started_at   timestamptz NOT NULL DEFAULT now(),
  ends_at      timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'active',         -- 'active' | 'awaiting_choice' | 'completed'
  collected_at timestamptz,
  chosen_chest text,                                   -- 'mercader' | 'erudito' | 'cazador' una vez confirmado
  reward       jsonb                                   -- snapshot de la recompensa aplicada
);

CREATE INDEX chamber_runs_hero_idx        ON public.chamber_runs (hero_id);
CREATE INDEX chamber_runs_hero_status_idx ON public.chamber_runs (hero_id, status);

ALTER TABLE public.chamber_runs ENABLE ROW LEVEL SECURITY;

-- Solo el dueño del héroe puede leer/escribir sus propias cámaras
CREATE POLICY "chamber_runs: own data"
  ON public.chamber_runs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.heroes WHERE id = hero_id AND player_id = auth.uid())
  );
