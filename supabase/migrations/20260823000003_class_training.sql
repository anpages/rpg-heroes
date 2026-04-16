-- Sistema de entrenamiento de clase
-- El héroe puede estar en estado 'training' acumulando XP de clase (1/min).
-- XP se convierte en niveles de clase (cap 20), que dan bonos de stats según clase.

ALTER TABLE public.heroes
  ADD COLUMN IF NOT EXISTS class_level          int         NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS class_xp             int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS training_started_at  timestamptz;

-- Extender el CHECK de status para incluir 'training'
DO $$
DECLARE v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM   pg_constraint
  WHERE  conrelid = 'public.heroes'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%status%'
  LIMIT 1;
  IF v_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.heroes DROP CONSTRAINT "' || v_name || '"';
  END IF;
END $$;

ALTER TABLE public.heroes
  ADD CONSTRAINT heroes_status_check
    CHECK (status IN ('idle', 'exploring', 'resting', 'training'));
