CREATE TABLE daily_missions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  date          date NOT NULL,
  type          text NOT NULL,
  tier          integer NOT NULL DEFAULT 0, -- 0=fácil, 1=medio, 2=difícil
  target_value  integer NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  completed     boolean NOT NULL DEFAULT false,
  claimed       boolean NOT NULL DEFAULT false,
  reward_gold   integer NOT NULL DEFAULT 0,
  reward_mana   integer NOT NULL DEFAULT 0,
  reward_xp     integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_daily_missions_player_date ON daily_missions(player_id, date);

ALTER TABLE daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions_own" ON daily_missions
  FOR ALL USING (player_id = auth.uid());
