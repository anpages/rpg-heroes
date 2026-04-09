-- Añade costes de fragmentos y esencia a las recetas de pociones.
-- Las pociones básicas (Nv.1) solo usan oro y maná.
-- Las pociones avanzadas (Nv.2) requieren además fragmentos.
-- Las pociones de élite (Nv.3+, futuras) requerirán esencia.

ALTER TABLE potion_catalog
  ADD COLUMN IF NOT EXISTS recipe_fragments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recipe_essence   integer NOT NULL DEFAULT 0;

-- Pociones Nv.2: 1 fragmento cada una
UPDATE potion_catalog SET recipe_fragments = 1 WHERE id IN ('hp_major', 'power', 'shield', 'wisdom');
