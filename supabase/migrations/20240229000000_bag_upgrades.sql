-- Ampliación de mochila: slots extra comprados con oro
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS bag_extra_slots smallint NOT NULL DEFAULT 0;

-- Impedir valores negativos o superiores al máximo (5 niveles)
ALTER TABLE public.resources
  ADD CONSTRAINT resources_bag_extra_slots_range
  CHECK (bag_extra_slots >= 0 AND bag_extra_slots <= 5);
