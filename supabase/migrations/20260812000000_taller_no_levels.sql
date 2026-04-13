-- ══════════════════════════════════════════════════════════════════════════════
-- Taller sin niveles: min_refinery_level = 1 para todas las recetas del taller
-- y bajar edificios laboratory con level > 1 a nivel 1
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Todas las recetas del taller en nivel 1 (sin niveles de edificio)
UPDATE crafting_catalog SET min_refinery_level = 1
WHERE refinery_type = 'laboratory';

-- 2. Bajar laboratorios con nivel > 1 a nivel 1
UPDATE buildings SET level = 1 WHERE type = 'laboratory' AND level > 1;
