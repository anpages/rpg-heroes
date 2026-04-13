-- ══════════════════════════════════════════════════════════════════════════════
-- Actualizar unit_duration_ms de slots activos para que reflejen los nuevos
-- craft_minutes. Los slots ya en curso se grabaron con los tiempos viejos.
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE player_refining_slots rs
SET unit_duration_ms = c.craft_minutes * 60 * 1000
FROM crafting_catalog c
WHERE rs.recipe_id = c.id
  AND rs.unit_duration_ms != c.craft_minutes * 60 * 1000;
