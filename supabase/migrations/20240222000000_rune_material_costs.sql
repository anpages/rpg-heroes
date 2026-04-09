-- Añade costes de fragmentos y esencia a las recetas de runas.
-- Las runas son mejoras permanentes, por eso requieren esencia.

ALTER TABLE rune_catalog
  ADD COLUMN IF NOT EXISTS recipe_fragments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recipe_essence   integer NOT NULL DEFAULT 0;

-- Runas de stat único (Nv.2): 2 fragmentos + 1 esencia
UPDATE rune_catalog SET recipe_fragments = 2, recipe_essence = 1
  WHERE name IN ('Runa de Fuego', 'Runa de Hielo', 'Runa de Tormenta', 'Runa de Viento', 'Runa de Tierra');

-- Runa de Luz (multi-stat): 3 fragmentos + 2 esencia
UPDATE rune_catalog SET recipe_fragments = 3, recipe_essence = 2
  WHERE name = 'Runa de Luz';
