-- ─────────────────────────────────────────────────────────────���───────────────
-- RESET COMPLETO DE TODOS LOS JUGADORES
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- NO es una migración — no aplicar con supabase db push.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Borrar progreso de torre
DELETE FROM public.tower_progress;

-- 2. Borrar compras de tienda
DELETE FROM public.shop_purchases;

-- 3. Borrar items del inventario y equipo
DELETE FROM public.hero_items;

-- 4. Borrar cartas de héroes
DELETE FROM public.hero_cards;

-- 5. Borrar expediciones activas
DELETE FROM public.expeditions;

-- 6. Borrar héroes (el jugador los recreará desde el onboarding)
DELETE FROM public.heroes;

-- 7. Resetear edificios a nivel 1, sin mejora en curso
UPDATE public.buildings SET
  level               = 1,
  upgrade_started_at  = NULL,
  upgrade_ends_at     = NULL;

-- 8. Resetear recursos a valores iniciales
UPDATE public.resources SET
  gold              = 100,
  wood              = 60,
  mana              = 20,
  gold_rate         = 2,
  wood_rate         = 1,
  mana_rate         = 1,
  last_collected_at = NOW();

-- ─────────────────────────────────────────────────────────��───────────────────
-- Verificación: debería devolver 0 en todas las tablas borradas
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'tower_progress' AS tabla, COUNT(*) FROM public.tower_progress
UNION ALL
SELECT 'shop_purchases',          COUNT(*) FROM public.shop_purchases
UNION ALL
SELECT 'hero_items',              COUNT(*) FROM public.hero_items
UNION ALL
SELECT 'hero_cards',              COUNT(*) FROM public.hero_cards
UNION ALL
SELECT 'expeditions',             COUNT(*) FROM public.expeditions
UNION ALL
SELECT 'heroes',                  COUNT(*) FROM public.heroes;
