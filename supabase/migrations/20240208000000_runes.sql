-- Sistema de Runas (Base v2 Fase 2)
-- Runas: crafteo en Laboratorio Nv.2, incrustación permanente en ítems equipados
-- Slots por nivel de Herrería: Nv.1=0, Nv.2=1, Nv.3+=2

-- ── Catálogo estático ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rune_catalog (
  id             serial PRIMARY KEY,
  name           text    NOT NULL,
  description    text    NOT NULL,
  bonuses        jsonb   NOT NULL DEFAULT '[]',  -- [{stat, value}]
  recipe_gold    integer NOT NULL DEFAULT 0,
  recipe_wood    integer NOT NULL DEFAULT 0,
  recipe_mana    integer NOT NULL DEFAULT 0,
  min_lab_level  integer NOT NULL DEFAULT 2
);

ALTER TABLE public.rune_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rune_catalog_read" ON public.rune_catalog FOR SELECT USING (true);

-- ── Inventario de runas por héroe (craftadas pero no incrustadas) ─────────────

CREATE TABLE IF NOT EXISTS public.hero_runes (
  id        uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id   uuid    NOT NULL REFERENCES public.heroes(id) ON DELETE CASCADE,
  rune_id   integer NOT NULL REFERENCES public.rune_catalog(id),
  quantity  integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  UNIQUE(hero_id, rune_id)
);

ALTER TABLE public.hero_runes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hero_runes_own" ON public.hero_runes
  FOR ALL USING (
    hero_id IN (SELECT id FROM public.heroes WHERE player_id = auth.uid())
  );

-- ── Runas incrustadas en ítems ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.item_runes (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id  uuid    NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  slot_index         integer NOT NULL CHECK (slot_index IN (0, 1)),
  rune_id            integer NOT NULL REFERENCES public.rune_catalog(id),
  created_at         timestamptz DEFAULT now(),
  UNIQUE(inventory_item_id, slot_index)
);

ALTER TABLE public.item_runes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_runes_own" ON public.item_runes
  FOR ALL USING (
    inventory_item_id IN (
      SELECT ii.id FROM public.inventory_items ii
      JOIN public.heroes h ON h.id = ii.hero_id
      WHERE h.player_id = auth.uid()
    )
  );

CREATE INDEX idx_item_runes_item ON public.item_runes(inventory_item_id);

-- ── Seed: 6 runas ─────────────────────────────────────────────────────────────

INSERT INTO public.rune_catalog (name, description, bonuses, recipe_gold, recipe_wood, recipe_mana, min_lab_level) VALUES
  ('Runa de Fuego',    'Infunde el arma con llamas, aumentando el ataque.',          '[{"stat":"attack","value":5}]',       80, 0, 40, 2),
  ('Runa de Hielo',    'Endurece el equipo para resistir los golpes.',               '[{"stat":"defense","value":4}]',      80, 0, 40, 2),
  ('Runa de Tormenta', 'Canaliza energía arcana para potenciar la inteligencia.',    '[{"stat":"intelligence","value":4}]', 80, 0, 40, 2),
  ('Runa de Viento',   'Aporta ligereza y velocidad de reacción.',                   '[{"stat":"agility","value":4}]',      60, 0, 30, 2),
  ('Runa de Tierra',   'Refuerza el cuerpo con vitalidad de la tierra.',             '[{"stat":"max_hp","value":20}]',      60, 30,  0, 2),
  ('Runa de Luz',      'Equilibra ataque, defensa e inteligencia a partes iguales.', '[{"stat":"attack","value":3},{"stat":"defense","value":3},{"stat":"intelligence","value":3}]', 150, 0, 80, 2);
