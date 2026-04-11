-- Añade status_ends_at a heroes: marca cuándo termina la actividad activa
-- (expedición o cámara). Permite que interpolateHP reanude la regeneración
-- pasiva de HP desde ese momento aunque el jugador todavía no haya recogido.
--
-- Semántica:
--   - NULL cuando el héroe está idle
--   - = expedition.ends_at mientras dura una expedición
--   - = chamber_run.ends_at mientras dura una cámara
--   - se resetea a NULL cuando se recoge/confirma la actividad

ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS status_ends_at TIMESTAMPTZ NULL;

-- Rellenar retroactivamente para héroes que ya están en exploring
UPDATE heroes h
SET status_ends_at = e.ends_at
FROM expeditions e
WHERE e.hero_id = h.id
  AND e.status = 'traveling'
  AND h.status = 'exploring'
  AND h.status_ends_at IS NULL;

UPDATE heroes h
SET status_ends_at = c.ends_at
FROM chamber_runs c
WHERE c.hero_id = h.id
  AND c.status IN ('active', 'awaiting_choice')
  AND h.status = 'exploring'
  AND h.status_ends_at IS NULL;
