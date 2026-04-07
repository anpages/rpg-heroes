-- Salas de entrenamiento de la Base (por jugador, no por héroe)
-- Cada sala tiene su propio nivel que determina la velocidad de acumulación de XP

CREATE TABLE IF NOT EXISTS training_rooms (
  player_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat       text NOT NULL CHECK (stat IN ('strength','agility','attack','defense','intelligence')),
  level      int  NOT NULL DEFAULT 1 CHECK (level >= 1),
  built_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, stat)
);

ALTER TABLE training_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_rooms_self"
  ON training_rooms FOR ALL TO authenticated
  USING  (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());
