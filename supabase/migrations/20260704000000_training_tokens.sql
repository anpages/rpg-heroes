-- ══════════════════════════════════════════════════════════════════════════════
-- Tokens de entrenamiento: los jugadores asignan stat points manualmente
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS player_training_tokens (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  stat      text NOT NULL,
  quantity  int  NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (player_id, stat)
);

-- RLS: el jugador solo ve/modifica sus propios tokens
ALTER TABLE player_training_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players see own tokens"
  ON player_training_tokens
  FOR ALL
  USING (player_id = auth.uid());
