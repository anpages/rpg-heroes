-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY: Corregir políticas FOR ALL en tablas creadas tras la migración
-- de seguridad original (20240126000000_security_readonly_rls.sql).
--
-- Las tres tablas tenían FOR ALL, lo que permite INSERT/UPDATE/DELETE directo
-- desde el cliente anon. Se reemplazan por FOR SELECT únicamente.
-- Todas las escrituras deben ir por los endpoints /api/* con service_role.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── hero_tactics ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "hero_tactics_own" ON public.hero_tactics;

CREATE POLICY "hero_tactics: own read"
  ON public.hero_tactics FOR SELECT
  USING (
    hero_id IN (SELECT id FROM public.heroes WHERE player_id = auth.uid())
  );

-- ── player_training_tokens ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Players see own tokens" ON public.player_training_tokens;

CREATE POLICY "player_training_tokens: own read"
  ON public.player_training_tokens FOR SELECT
  USING (player_id = auth.uid());

-- ── player_refining_slots ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage own refining slots" ON public.player_refining_slots;

CREATE POLICY "player_refining_slots: own read"
  ON public.player_refining_slots FOR SELECT
  USING (player_id = auth.uid());
