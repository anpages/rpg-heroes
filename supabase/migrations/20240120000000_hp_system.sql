-- HP system: track when HP was last updated for interpolation

ALTER TABLE heroes ADD COLUMN IF NOT EXISTS hp_last_updated_at timestamptz DEFAULT now();

-- Initialize for existing heroes (set to now so they start regenerating from current HP)
UPDATE heroes SET hp_last_updated_at = now() WHERE hp_last_updated_at IS NULL;
