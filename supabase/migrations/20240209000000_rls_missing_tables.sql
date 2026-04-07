-- Habilitar RLS en tablas que quedaron fuera de la migración de seguridad original

-- ── tournament_brackets ───────────────────────────────────────────────────────
ALTER TABLE tournament_brackets ENABLE ROW LEVEL SECURITY;

-- Los brackets son visibles para todos los jugadores autenticados (clasificación pública)
CREATE POLICY "tournament_brackets: authenticated read"
  ON tournament_brackets FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── tournament_matches ────────────────────────────────────────────────────────
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_matches: authenticated read"
  ON tournament_matches FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── hero_training ─────────────────────────────────────────────────────────────
ALTER TABLE hero_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hero_training: own read"
  ON hero_training FOR SELECT
  USING (
    hero_id IN (SELECT id FROM public.heroes WHERE player_id = auth.uid())
  );

-- ── potion_catalog ────────────────────────────────────────────────────────────
ALTER TABLE potion_catalog ENABLE ROW LEVEL SECURITY;

-- Catálogo estático — lectura pública para autenticados
CREATE POLICY "potion_catalog: authenticated read"
  ON potion_catalog FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── hero_potions ──────────────────────────────────────────────────────────────
ALTER TABLE hero_potions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hero_potions: own read"
  ON hero_potions FOR SELECT
  USING (
    hero_id IN (SELECT id FROM public.heroes WHERE player_id = auth.uid())
  );
