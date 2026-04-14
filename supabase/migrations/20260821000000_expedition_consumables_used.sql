ALTER TABLE expeditions
  ADD COLUMN IF NOT EXISTS consumables_used TEXT[] DEFAULT '{}';
