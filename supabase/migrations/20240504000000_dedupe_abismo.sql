-- ─────────────────────────────────────────────────────────────────────────────
-- Deduplicar "Abismo de las Almas"
-- ─────────────────────────────────────────────────────────────────────────────
-- La migración 20240216 hacía un INSERT sin guard. En producción quedó
-- duplicada (probablemente reaplicada manualmente). Esta migración:
--   1. Elige el ID más antiguo (lexicográficamente menor) como canónico.
--   2. Reasigna las referencias activas (expediciones, modificador semanal)
--      al canónico.
--   3. Borra los duplicados restantes.
-- Idempotente: si solo hay una fila, no hace nada.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  keep_id uuid;
BEGIN
  SELECT id INTO keep_id
  FROM public.dungeons
  WHERE name = 'Abismo de las Almas'
  ORDER BY id
  LIMIT 1;

  IF keep_id IS NULL THEN
    RETURN;
  END IF;

  -- Reasignar expediciones que apunten al duplicado (evita NULL por ON DELETE SET NULL)
  UPDATE public.expeditions
  SET dungeon_id = keep_id
  WHERE dungeon_id IN (
    SELECT id FROM public.dungeons
    WHERE name = 'Abismo de las Almas' AND id <> keep_id
  );

  -- Reasignar modificador semanal per-hero (ON DELETE CASCADE borraría la fila)
  UPDATE public.weekly_dungeon_modifier
  SET dungeon_id = keep_id
  WHERE dungeon_id IN (
    SELECT id FROM public.dungeons
    WHERE name = 'Abismo de las Almas' AND id <> keep_id
  );

  -- Borrar duplicados
  DELETE FROM public.dungeons
  WHERE name = 'Abismo de las Almas' AND id <> keep_id;
END $$;
