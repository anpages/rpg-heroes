-- Re-añade Pergamino Táctico al laboratorio con ingredientes brutos.
-- Fue eliminado en 20260809 junto con recetas legacy; el endpoint tactic-levelup.js
-- lo sigue esperando con recipe_id = 'tactic_scroll'.

INSERT INTO crafting_catalog
  (id, name, description, category, icon, inputs, output_qty, craft_minutes, min_lab_level, refinery_type, min_refinery_level, effects)
VALUES
  (
    'tactic_scroll',
    'Pergamino Táctico',
    'Sube 1 nivel una táctica equipada (máx. Nv. 5). Mejora sus estadísticas y efectos de combate.',
    'tactic', '📜',
    '[{"resource":"mana","qty":20},{"resource":"fragments","qty":5}]'::jsonb,
    1, 20, 1, 'laboratory', 0,
    '[]'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  inputs      = EXCLUDED.inputs,
  craft_minutes = EXCLUDED.craft_minutes;
