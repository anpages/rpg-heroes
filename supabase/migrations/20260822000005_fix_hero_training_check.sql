-- Fix: hero_training CHECK constraint missing max_hp stat.
-- max_hp was added as a training room type but never added to the constraint.

ALTER TABLE hero_training DROP CONSTRAINT IF EXISTS hero_training_stat_check;

ALTER TABLE hero_training
  ADD CONSTRAINT hero_training_stat_check
  CHECK (stat IN ('strength','agility','attack','defense','intelligence','max_hp'));
