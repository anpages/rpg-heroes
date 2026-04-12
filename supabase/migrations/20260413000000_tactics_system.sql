-- Sistema de Tacticas — reemplazo de runas y cartas
-- Cada tactica proporciona bonificadores de stats + efecto de combate
-- Los heroes tienen 5 slots de tacticas que definen su "build"

-- ── Catalogo estatico de tacticas ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tactic_catalog (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text    NOT NULL,
  description     text,
  category        text    NOT NULL CHECK (category IN ('offensive','defensive','tactical','utility')),
  rarity          text    NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  required_class  text    CHECK (required_class IN ('caudillo','arcanista','sombra','domador')),
  stat_bonuses    jsonb   NOT NULL DEFAULT '[]',   -- [{stat:'attack', value:5}]
  combat_effect   jsonb   NOT NULL DEFAULT '{}',   -- {trigger, effect, params...}
  max_level       int     NOT NULL DEFAULT 5,
  icon            text    DEFAULT '⚔'
);

ALTER TABLE public.tactic_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tactic_catalog_read" ON public.tactic_catalog FOR SELECT USING (true);

-- ── Inventario de tacticas por heroe ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hero_tactics (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_id     uuid    NOT NULL REFERENCES public.heroes(id) ON DELETE CASCADE,
  tactic_id   uuid    NOT NULL REFERENCES public.tactic_catalog(id),
  level       int     NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  slot_index  int     CHECK (slot_index >= 0 AND slot_index < 5),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(hero_id, tactic_id)
);

-- Solo una tactica por slot (cuando slot_index no es null)
CREATE UNIQUE INDEX idx_hero_tactics_slot
  ON public.hero_tactics(hero_id, slot_index)
  WHERE slot_index IS NOT NULL;

ALTER TABLE public.hero_tactics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hero_tactics_own" ON public.hero_tactics
  FOR ALL USING (
    hero_id IN (SELECT id FROM public.heroes WHERE player_id = auth.uid())
  );

CREATE INDEX idx_hero_tactics_hero ON public.hero_tactics(hero_id);

-- ── Seed: Tacticas universales ────────────────────────────────────────────────

INSERT INTO public.tactic_catalog (name, description, category, rarity, stat_bonuses, combat_effect, icon) VALUES

-- OFFENSIVE (universal)
('Emboscada',
 'Ataque sorpresa al inicio del combate.',
 'offensive', 'common',
 '[{"stat":"attack","value":4}]',
 '{"trigger":"start_of_combat","effect":"guaranteed_crit","duration":1}',
 '🗡'),

('Furia Interior',
 'La desesperacion desata tu verdadero poder.',
 'offensive', 'uncommon',
 '[{"stat":"strength","value":4}]',
 '{"trigger":"hp_below_pct","threshold":0.30,"effect":"damage_mult","value":1.40,"duration":2}',
 '🔥'),

('Golpe Arcano',
 'Canaliza energia magica en tus ataques.',
 'offensive', 'uncommon',
 '[{"stat":"intelligence","value":5}]',
 '{"trigger":"round_n","n":3,"effect":"bonus_magic_damage","value":0.50}',
 '✨'),

('Sed de Sangre',
 'Cada golpe critico restaura vitalidad.',
 'offensive', 'rare',
 '[{"stat":"attack","value":3},{"stat":"strength","value":2}]',
 '{"trigger":"on_crit","effect":"heal_pct","value":0.08}',
 '🩸'),

('Impacto Demoledor',
 'Tus ataques ignoran parte de la armadura enemiga.',
 'offensive', 'rare',
 '[{"stat":"strength","value":5}]',
 '{"trigger":"round_n","n":4,"effect":"armor_pen_boost","value":0.20,"duration":2}',
 '💥'),

('Tormenta de Acero',
 'Desata una rafaga de golpes imparables.',
 'offensive', 'epic',
 '[{"stat":"attack","value":5},{"stat":"agility","value":3}]',
 '{"trigger":"round_n","n":5,"effect":"double_attack","duration":1}',
 '⚡'),

-- DEFENSIVE (universal)
('Muro de Hierro',
 'Levanta un escudo que absorbe dano.',
 'defensive', 'common',
 '[{"stat":"defense","value":4}]',
 '{"trigger":"round_n","n":3,"effect":"absorb_shield","value":0.20}',
 '🛡'),

('Instinto de Supervivencia',
 'Cuando todo parece perdido, tu cuerpo resiste.',
 'defensive', 'uncommon',
 '[{"stat":"max_hp","value":10}]',
 '{"trigger":"hp_below_pct","threshold":0.25,"effect":"heal_pct","value":0.15,"once":true}',
 '💚'),

('Postura Ferrea',
 'Reduces el dano critico recibido.',
 'defensive', 'uncommon',
 '[{"stat":"defense","value":3},{"stat":"strength","value":2}]',
 '{"trigger":"passive","effect":"reduce_crit_damage","value":0.30}',
 '🏔'),

('Voluntad Inquebrantable',
 'Tu determinacion te hace mas resistente.',
 'defensive', 'rare',
 '[{"stat":"max_hp","value":8},{"stat":"defense","value":3}]',
 '{"trigger":"hp_below_pct","threshold":0.50,"effect":"damage_reduction","value":0.15,"duration":3}',
 '🔱'),

('Coraza Vital',
 'Absorbes parte del dano como regeneracion.',
 'defensive', 'epic',
 '[{"stat":"max_hp","value":12},{"stat":"defense","value":4}]',
 '{"trigger":"round_n","n":2,"effect":"absorb_shield","value":0.25}',
 '🫀'),

-- TACTICAL (universal)
('Paso Veloz',
 'Tu agilidad te permite esquivar ataques.',
 'tactical', 'common',
 '[{"stat":"agility","value":5}]',
 '{"trigger":"round_n","n":4,"effect":"guaranteed_dodge","duration":1}',
 '💨'),

('Concentracion',
 'Tras esquivar, tu siguiente golpe es devastador.',
 'tactical', 'uncommon',
 '[{"stat":"intelligence","value":3},{"stat":"agility","value":2}]',
 '{"trigger":"on_dodge","effect":"damage_mult_next","value":1.50}',
 '🎯'),

('Contraataque',
 'Respondes automaticamente cuando recibes dano.',
 'tactical', 'rare',
 '[{"stat":"strength","value":3}]',
 '{"trigger":"hp_below_pct","threshold":0.50,"effect":"counter_attack","chance":0.40}',
 '↩'),

('Lectura de Combate',
 'Anticipas los movimientos del enemigo.',
 'tactical', 'rare',
 '[{"stat":"intelligence","value":4},{"stat":"agility","value":2}]',
 '{"trigger":"round_n","n":2,"effect":"dodge_boost","value":0.25,"duration":2}',
 '👁'),

('Trampa Tactica',
 'Colocas una trampa que reduce las stats del enemigo.',
 'tactical', 'epic',
 '[{"stat":"intelligence","value":5}]',
 '{"trigger":"round_n","n":1,"effect":"enemy_debuff","stat":"attack","value":0.15,"duration":3}',
 '🪤'),

-- UTILITY (universal)
('Aura de Liderazgo',
 'Tu presencia fortalece todas tus capacidades.',
 'utility', 'common',
 '[{"stat":"defense","value":2},{"stat":"attack","value":2}]',
 '{"trigger":"passive","effect":"all_stats_pct","value":0.03}',
 '👑'),

('Preparacion Tactica',
 'Llegas al combate con ventaja estrategica.',
 'utility', 'uncommon',
 '[{"stat":"agility","value":3},{"stat":"intelligence","value":2}]',
 '{"trigger":"start_of_combat","effect":"stat_buff","stat":"agility","value":0.20,"duration":3}',
 '📋'),

('Segundo Aliento',
 'Recuperas fuerzas en mitad del combate.',
 'utility', 'rare',
 '[{"stat":"max_hp","value":6},{"stat":"strength","value":3}]',
 '{"trigger":"round_n","n":6,"effect":"heal_pct","value":0.12}',
 '🌬'),

('Adaptacion',
 'Te adaptas al estilo de combate del enemigo.',
 'utility', 'epic',
 '[{"stat":"defense","value":3},{"stat":"agility","value":3}]',
 '{"trigger":"round_n","n":4,"effect":"mirror_stance","duration":3}',
 '🔄');

-- ── Seed: Tacticas exclusivas de clase ────────────────────────────────────────

INSERT INTO public.tactic_catalog (name, description, category, rarity, required_class, stat_bonuses, combat_effect, icon) VALUES

-- CAUDILLO
('Grito de Guerra',
 'Tu grito aumenta tu defensa y fortaleza.',
 'defensive', 'rare', 'caudillo',
 '[{"stat":"defense","value":5},{"stat":"max_hp","value":8}]',
 '{"trigger":"round_n","n":2,"effect":"damage_reduction","value":0.20,"duration":3}',
 '📯'),

('Baluarte Invencible',
 'Te conviertes en una fortaleza inamovible.',
 'defensive', 'epic', 'caudillo',
 '[{"stat":"defense","value":6},{"stat":"max_hp","value":10}]',
 '{"trigger":"hp_below_pct","threshold":0.40,"effect":"absorb_shield","value":0.30,"once":true}',
 '🏰'),

-- ARCANISTA
('Canalizacion Arcana',
 'Tu magia se intensifica con cada ronda.',
 'offensive', 'rare', 'arcanista',
 '[{"stat":"intelligence","value":6}]',
 '{"trigger":"round_n","n":3,"effect":"pure_magic_burst","value":0.60}',
 '🔮'),

('Sobrecarga Mistica',
 'Liberas toda tu energia magica de golpe.',
 'offensive', 'epic', 'arcanista',
 '[{"stat":"intelligence","value":7},{"stat":"attack","value":3}]',
 '{"trigger":"round_n","n":5,"effect":"pure_magic_burst","value":1.00}',
 '💎'),

-- SOMBRA
('Sigilo Mortal',
 'Inicias el combate invisible.',
 'tactical', 'rare', 'sombra',
 '[{"stat":"agility","value":5},{"stat":"attack","value":2}]',
 '{"trigger":"start_of_combat","effect":"stealth","duration":1}',
 '🌑'),

('Golpe Fantasma',
 'Atacas desde las sombras con precision letal.',
 'offensive', 'epic', 'sombra',
 '[{"stat":"agility","value":5},{"stat":"strength","value":4}]',
 '{"trigger":"on_dodge","effect":"guaranteed_crit_next"}',
 '👻'),

-- DOMADOR
('Instinto Salvaje',
 'Tu primer golpe es siempre devastador.',
 'offensive', 'rare', 'domador',
 '[{"stat":"strength","value":5},{"stat":"attack","value":2}]',
 '{"trigger":"start_of_combat","effect":"first_hit_mult","value":1.50}',
 '🐺'),

('Furia Imparable',
 'Cuanto mas dano recibes, mas fuerte golpeas.',
 'offensive', 'epic', 'domador',
 '[{"stat":"strength","value":6},{"stat":"attack","value":4}]',
 '{"trigger":"hp_below_pct","threshold":0.40,"effect":"damage_mult","value":1.60,"duration":99}',
 '🦁');


-- ── Drop tablas antiguas ──────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.item_runes;
DROP TABLE IF EXISTS public.player_rune_crafting;
DROP TABLE IF EXISTS public.player_runes;
DROP TABLE IF EXISTS public.hero_runes;
DROP TABLE IF EXISTS public.rune_catalog CASCADE;
DROP TABLE IF EXISTS public.hero_cards;
DROP TABLE IF EXISTS public.skill_cards CASCADE;
