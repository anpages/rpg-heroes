-- Nivel Maestría (★): tácticas pueden alcanzar nivel 6 mediante drop duplicado.
-- Los pergaminos siguen limitados al nivel 5. Solo los duplicados otorgan nivel 6.
ALTER TABLE public.hero_tactics
  DROP CONSTRAINT IF EXISTS hero_tactics_level_check;
ALTER TABLE public.hero_tactics
  ADD CONSTRAINT hero_tactics_level_check
  CHECK (level >= 1 AND level <= 6);
