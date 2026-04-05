-- ─────────────────────────────────────────────────────────────────────────────
-- RESET COMPLETO DE TODOS LOS JUGADORES
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- NO es una migración — no aplicar con supabase db push.
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM public.tower_attempts;
DELETE FROM public.tower_progress;
DELETE FROM public.shop_purchases;
DELETE FROM public.inventory_items;
DELETE FROM public.hero_cards;
DELETE FROM public.expeditions;
DELETE FROM public.daily_missions;
DELETE FROM public.heroes;

UPDATE public.buildings SET
  level              = 1,
  unlocked           = type IN ('barracks', 'gold_mine', 'energy_nexus'),
  upgrade_started_at = NULL,
  upgrade_ends_at    = NULL;

UPDATE public.resources SET
  gold              = 200,
  wood              = 120,
  mana              = 0,
  gold_rate         = 2,
  wood_rate         = 0,
  mana_rate         = 0,
  last_collected_at = NOW();

-- Verificación: todas deben devolver 0
SELECT 'tower_progress'  AS tabla, COUNT(*) FROM public.tower_progress  UNION ALL
SELECT 'tower_attempts',            COUNT(*) FROM public.tower_attempts  UNION ALL
SELECT 'shop_purchases',            COUNT(*) FROM public.shop_purchases  UNION ALL
SELECT 'inventory_items',           COUNT(*) FROM public.inventory_items UNION ALL
SELECT 'hero_cards',                COUNT(*) FROM public.hero_cards      UNION ALL
SELECT 'expeditions',               COUNT(*) FROM public.expeditions     UNION ALL
SELECT 'daily_missions',            COUNT(*) FROM public.daily_missions  UNION ALL
SELECT 'heroes',                    COUNT(*) FROM public.heroes;
