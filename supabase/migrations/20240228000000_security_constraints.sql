-- ─────────────────────────────────────────────────────────────────────────────
-- Parche de seguridad: constraints para prevenir exploits
-- 1. CHECK constraints en recursos (impide valores negativos)
-- 2. UNIQUE partial en equipped_slot (impide duplicar slot)
-- 3. ON DELETE en FKs huérfanas
-- 4. Índices de rendimiento en columnas frecuentes
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CHECK constraints — recursos nunca negativos
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.resources
  ADD CONSTRAINT resources_gold_non_negative      CHECK (gold >= 0),
  ADD CONSTRAINT resources_iron_non_negative      CHECK (iron >= 0),
  ADD CONSTRAINT resources_wood_non_negative      CHECK (wood >= 0),
  ADD CONSTRAINT resources_mana_non_negative      CHECK (mana >= 0),
  ADD CONSTRAINT resources_fragments_non_negative CHECK (fragments >= 0),
  ADD CONSTRAINT resources_essence_non_negative   CHECK (essence >= 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. UNIQUE partial — un solo ítem por slot equipado por héroe
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_hero_equipped_slot
  ON public.inventory_items (hero_id, equipped_slot)
  WHERE equipped_slot IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ON DELETE constraints en FKs huérfanas
-- ═══════════════════════════════════════════════════════════════════════════════

-- inventory_items.catalog_id → CASCADE (si se borra del catálogo, se borran los ítems)
ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_catalog_id_fkey,
  ADD CONSTRAINT inventory_items_catalog_id_fkey
    FOREIGN KEY (catalog_id) REFERENCES public.item_catalog(id) ON DELETE CASCADE;

-- hero_cards.card_id → CASCADE
ALTER TABLE public.hero_cards
  DROP CONSTRAINT IF EXISTS hero_cards_card_id_fkey,
  ADD CONSTRAINT hero_cards_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES public.skill_cards(id) ON DELETE CASCADE;

-- item_runes.rune_id → CASCADE
ALTER TABLE public.item_runes
  DROP CONSTRAINT IF EXISTS item_runes_rune_id_fkey,
  ADD CONSTRAINT item_runes_rune_id_fkey
    FOREIGN KEY (rune_id) REFERENCES public.rune_catalog(id) ON DELETE CASCADE;

-- expeditions.dungeon_id → SET NULL (si se borra dungeon, la expedición queda pero sin referencia)
ALTER TABLE public.expeditions
  DROP CONSTRAINT IF EXISTS expeditions_dungeon_id_fkey,
  ADD CONSTRAINT expeditions_dungeon_id_fkey
    FOREIGN KEY (dungeon_id) REFERENCES public.dungeons(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Índices de rendimiento
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_buildings_player_id      ON public.buildings(player_id);
CREATE INDEX IF NOT EXISTS idx_hero_cards_hero_id       ON public.hero_cards(hero_id);
CREATE INDEX IF NOT EXISTS idx_expeditions_hero_id      ON public.expeditions(hero_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_hero_id  ON public.inventory_items(hero_id);
