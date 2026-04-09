-- Cola de crafteo de runas (una por héroe a la vez, igual que pociones)
CREATE TABLE IF NOT EXISTS rune_crafting (
  hero_id        UUID    PRIMARY KEY REFERENCES heroes(id) ON DELETE CASCADE,
  rune_id        INTEGER NOT NULL REFERENCES rune_catalog(id),
  craft_ends_at  TIMESTAMPTZ NOT NULL
);

ALTER TABLE rune_crafting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rune_crafting_owner" ON rune_crafting
  FOR ALL USING (
    hero_id IN (SELECT id FROM heroes WHERE player_id = auth.uid())
  );
