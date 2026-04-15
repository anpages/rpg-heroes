-- Frenético (caudillo) tenía attack_bonus que no corresponde a la clase.
-- Caudillo solo puede mejorar strength, defense, max_hp.
UPDATE public.tactic_catalog
SET stat_bonuses = '[{"stat":"strength","value":5},{"stat":"max_hp","value":15}]'
WHERE name = 'Frenético' AND required_class = 'caudillo';
