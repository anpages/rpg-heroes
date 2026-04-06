-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY: Políticas RLS de solo-lectura para el cliente anon
--
-- PROBLEMA: Las políticas anteriores eran FOR ALL, lo que permitía que cualquier
-- jugador con la clave anon (visible en DevTools) pudiera escribir directamente
-- en la BD:
--   supabase.from('heroes').update({ attack: 9999 }).eq('id', ...)
--   supabase.from('hero_cards').update({ rank: 999 }).eq('id', ...)
--   supabase.from('resources').update({ gold: 999999 }).eq('player_id', ...)
--
-- SOLUCIÓN: El cliente anon solo puede SELECT. Todas las escrituras van por
-- los endpoints /api/* que usan service_role (ignora RLS — es de confianza).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Eliminar políticas FOR ALL y FOR INSERT/UPDATE peligrosas ─────────────

DROP POLICY IF EXISTS "players: own data"         ON public.players;
DROP POLICY IF EXISTS "resources: own data"       ON public.resources;
DROP POLICY IF EXISTS "buildings: own data"       ON public.buildings;
DROP POLICY IF EXISTS "heroes: own data"          ON public.heroes;
DROP POLICY IF EXISTS "hero_abilities: own data"  ON public.hero_abilities;
DROP POLICY IF EXISTS "expeditions: own data"     ON public.expeditions;
DROP POLICY IF EXISTS "hero_cards: own hero"      ON public.hero_cards;
DROP POLICY IF EXISTS "inventory_items: own hero" ON public.inventory_items;
DROP POLICY IF EXISTS "tower_progress_own"        ON public.tower_progress;
DROP POLICY IF EXISTS "tower_attempts_own"        ON public.tower_attempts;
DROP POLICY IF EXISTS "missions_own"              ON public.daily_missions;
DROP POLICY IF EXISTS "shop_purchases_own_insert" ON public.shop_purchases;
DROP POLICY IF EXISTS "shop_purchases_own_update" ON public.shop_purchases;

-- ── 2. Políticas FOR SELECT solo — el cliente puede leer sus propios datos ────

CREATE POLICY "players: own read"
  ON public.players FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "resources: own read"
  ON public.resources FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "buildings: own read"
  ON public.buildings FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "heroes: own read"
  ON public.heroes FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "hero_abilities: own read"
  ON public.hero_abilities FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.heroes WHERE id = hero_id AND player_id = auth.uid()
  ));

CREATE POLICY "expeditions: own read"
  ON public.expeditions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.heroes WHERE id = hero_id AND player_id = auth.uid()
  ));

CREATE POLICY "hero_cards: own read"
  ON public.hero_cards FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.heroes WHERE id = hero_id AND player_id = auth.uid()
  ));

CREATE POLICY "inventory_items: own read"
  ON public.inventory_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.heroes WHERE id = hero_id AND player_id = auth.uid()
  ));

CREATE POLICY "tower_progress: own read"
  ON public.tower_progress FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.heroes WHERE id = hero_id AND player_id = auth.uid()
  ));

CREATE POLICY "tower_attempts: own read"
  ON public.tower_attempts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.heroes WHERE id = hero_id AND player_id = auth.uid()
  ));

CREATE POLICY "missions: own read"
  ON public.daily_missions FOR SELECT
  USING (auth.uid() = player_id);

-- shop_purchases_own_read ya existe como FOR SELECT — no hace falta recrearla

-- ── 3. CHECK constraints — cap en columnas críticas ───────────────────────────
-- Evitan que aunque alguien llegue a hacer un INSERT/UPDATE directo,
-- los valores absurdos sean rechazados por la BD.

-- Rango de cartas: máx 20 (muy generoso, el juego difícilmente superará 6-8)
ALTER TABLE public.hero_cards
  ADD CONSTRAINT hero_cards_rank_bounds
  CHECK (rank >= 1 AND rank <= 20);

-- Stats de héroe: deben ser positivos y con cap anti-exploit
ALTER TABLE public.heroes
  ADD CONSTRAINT heroes_stats_bounds
  CHECK (
    level          >= 1
    AND current_hp >= 0
    AND max_hp     >= 1
    AND attack         >= 0 AND attack         <= 9999
    AND defense        >= 0 AND defense        <= 9999
    AND strength       >= 0 AND strength       <= 9999
    AND agility        >= 0 AND agility        <= 9999
    AND intelligence   >= 0 AND intelligence   <= 9999
  );

-- Recursos: no pueden ser negativos
ALTER TABLE public.resources
  ADD CONSTRAINT resources_non_negative
  CHECK (
    gold >= 0 AND wood >= 0 AND mana >= 0
    AND gold_rate >= 0 AND wood_rate >= 0 AND mana_rate >= 0
  );
