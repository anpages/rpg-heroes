-- Cola de crafteo de pociones (una por héroe a la vez)
CREATE TABLE IF NOT EXISTS potion_crafting (
  hero_id        UUID PRIMARY KEY REFERENCES heroes(id) ON DELETE CASCADE,
  potion_id      TEXT NOT NULL REFERENCES potion_catalog(id),
  craft_ends_at  TIMESTAMPTZ NOT NULL
);

ALTER TABLE potion_crafting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "potion_crafting_owner" ON potion_crafting
  FOR ALL USING (
    hero_id IN (SELECT id FROM heroes WHERE player_id = auth.uid())
  );
