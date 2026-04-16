-- Estrategia de combate por héroe
-- 'aggressive' | 'balanced' | 'defensive'
-- Se aplica tanto en PvE como en PvP (defensa automática).

ALTER TABLE public.heroes
  ADD COLUMN IF NOT EXISTS combat_strategy text
  NOT NULL DEFAULT 'balanced'
  CHECK (combat_strategy IN ('aggressive', 'balanced', 'defensive'));
