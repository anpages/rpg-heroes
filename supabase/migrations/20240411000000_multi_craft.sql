-- Permitir múltiples crafteos simultáneos por héroe
-- PK pasa de (hero_id) a (hero_id, potion_id/rune_id)

ALTER TABLE potion_crafting DROP CONSTRAINT potion_crafting_pkey;
ALTER TABLE potion_crafting ADD CONSTRAINT potion_crafting_pkey PRIMARY KEY (hero_id, potion_id);

ALTER TABLE rune_crafting DROP CONSTRAINT rune_crafting_pkey;
ALTER TABLE rune_crafting ADD CONSTRAINT rune_crafting_pkey PRIMARY KEY (hero_id, rune_id);
