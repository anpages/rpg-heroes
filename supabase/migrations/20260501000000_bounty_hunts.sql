-- ─────────────────────────────────────────────────────────────────────────────
-- Caza de Botín: rutas de caza dirigida por slot
-- ─────────────────────────────────────────────────────────────────────────────
-- Mecánica:
--   • Cada héroe ve 3 "rutas" disponibles al día; cada ruta busca un slot fijo
--   • 1 intento por ruta; al fallar, la ruta queda agotada hasta el reset
--   • El jugador puede regenerar el pool pagando oro escalonado (máx 3/día)
--   • Cada intento cuesta iron/wood/gold/HP y tiene 40% de éxito base
--   • Si sale, el ítem es del slot elegido y rareza escalada al nivel del héroe
--   • Reset diario propio del héroe (24h desde la última generación)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.bounty_hunts (
  hero_id       uuid PRIMARY KEY REFERENCES public.heroes(id) ON DELETE CASCADE,
  routes        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ key, slot, used }]
  reset_at      timestamptz NOT NULL,                  -- próximo reset de rutas
  regens_today  integer NOT NULL DEFAULT 0             -- regens usados en la ventana actual
);

ALTER TABLE public.bounty_hunts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bounty_hunts: own data"
  ON public.bounty_hunts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.heroes WHERE id = hero_id AND player_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Runs activos de caza. Un héroe solo puede tener una caza en curso a la vez
-- (la cama comparte lock con cámaras y expediciones vía hero.status='exploring').
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.bounty_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id      uuid NOT NULL REFERENCES public.heroes(id) ON DELETE CASCADE,
  route_key    text NOT NULL,                          -- p.ej. 'cumbre_halcon'
  slot         text NOT NULL,                          -- slot objetivo (helmet, main_hand, ...)
  started_at   timestamptz NOT NULL DEFAULT now(),
  ends_at      timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'active',         -- 'active' | 'completed'
  result       jsonb                                   -- { success, rarity, itemId? }
);

CREATE INDEX bounty_runs_hero_idx        ON public.bounty_runs (hero_id);
CREATE INDEX bounty_runs_hero_status_idx ON public.bounty_runs (hero_id, status);

ALTER TABLE public.bounty_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bounty_runs: own data"
  ON public.bounty_runs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.heroes WHERE id = hero_id AND player_id = auth.uid())
  );
