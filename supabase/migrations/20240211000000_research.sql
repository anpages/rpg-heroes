-- ── Research tree ────────────────────────────────────────────────────────────

CREATE TABLE research_nodes (
  id              text PRIMARY KEY,
  branch          text NOT NULL,
  position        integer NOT NULL,
  name            text NOT NULL,
  description     text NOT NULL,
  effect_type     text NOT NULL,
  effect_value    float NOT NULL,
  cost_gold       integer NOT NULL DEFAULT 0,
  cost_iron       integer NOT NULL DEFAULT 0,
  cost_mana       integer NOT NULL DEFAULT 0,
  duration_hours  integer NOT NULL,
  prerequisite_id text REFERENCES research_nodes(id),
  UNIQUE(branch, position)
);

CREATE TABLE player_research (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id     text NOT NULL REFERENCES research_nodes(id),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz NOT NULL,
  UNIQUE(player_id, node_id)
);

CREATE INDEX idx_player_research_player ON player_research(player_id, status);

ALTER TABLE research_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_nodes_read" ON research_nodes FOR SELECT USING (true);

ALTER TABLE player_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_research_own" ON player_research FOR ALL USING (auth.uid() = player_id);

-- ── Seed 16 research nodes ────────────────────────────────────────────────────

INSERT INTO research_nodes (id, branch, position, name, description, effect_type, effect_value, cost_gold, cost_iron, cost_mana, duration_hours, prerequisite_id) VALUES
  -- Combat branch
  ('combat_1',     'combat',     1, 'Técnica de Ataque',    '+5% al ataque base.',                                    'attack_pct',         0.05,   100,  60,  30,   4, NULL),
  ('combat_2',     'combat',     2, 'Postura Defensiva',    '+5% a la defensa base.',                                 'defense_pct',        0.05,   200, 120,  80,  12, 'combat_1'),
  ('combat_3',     'combat',     3, 'Golpe Crítico',        '+3% probabilidad de crítico.',                           'crit_pct',           0.03,   500, 300, 200,  48, 'combat_2'),
  ('combat_4',     'combat',     4, 'Maestría en Combate',  '+10% al daño en la Torre.',                              'tower_dmg_pct',      0.10,  1200, 700, 500, 120, 'combat_3'),
  -- Expedition branch
  ('expedition_1', 'expedition', 1, 'Saqueo Eficiente',     '+5% al oro de expediciones.',                            'expedition_gold_pct', 0.05,  100,  60,  30,   4, NULL),
  ('expedition_2', 'expedition', 2, 'Mantenimiento',        '-10% al desgaste de equipo en expediciones.',            'durability_loss_pct',-0.10,  200, 120,  80,  12, 'expedition_1'),
  ('expedition_3', 'expedition', 3, 'Aprendizaje Acelerado','+5% a la XP de expediciones.',                           'expedition_xp_pct',  0.05,   500, 300, 200,  48, 'expedition_2'),
  ('expedition_4', 'expedition', 4, 'Doble Expedición',     'Permite enviar un héroe a dos expediciones simultáneas.','expedition_slots',   1,     1200, 700, 500, 120, 'expedition_3'),
  -- Crafting branch
  ('crafting_1',   'crafting',   1, 'Técnicas de Reparación','-10% al coste de reparación.',                          'repair_cost_pct',   -0.10,  100,  60,  30,   4, NULL),
  ('crafting_2',   'crafting',   2, 'Ojo de Buitre',         '+5% a la tasa de drop de ítems.',                       'item_drop_pct',      0.05,  200, 120,  80,  12, 'crafting_1'),
  ('crafting_3',   'crafting',   3, 'Grabado Profundo',      'Desbloquea un 3er slot de runa en todos los ítems.',     'rune_slot_bonus',    1,     500, 300, 200,  48, 'crafting_2'),
  ('crafting_4',   'crafting',   4, 'Artesano Supremo',      'Reduce en 1 el nivel de Lab necesario para craftear runas.','lab_req_reduction',1,  1200, 700, 500, 120, 'crafting_3'),
  -- Magic branch
  ('magic_1',      'magic',      1, 'Estudios Arcanos',      '+5% a la inteligencia base.',                            'intelligence_pct',  0.05,   100,  60,  30,   4, NULL),
  ('magic_2',      'magic',      2, 'Canalización Arcana',   '+5% a la producción de maná.',                           'mana_rate_pct',     0.05,   200, 120,  80,  12, 'magic_1'),
  ('magic_3',      'magic',      3, 'Fusión Rúnica',         '-10% al coste de fusión de cartas.',                     'fusion_cost_pct',  -0.10,   500, 300, 200,  48, 'magic_2'),
  ('magic_4',      'magic',      4, 'Resonancia Rúnica',     '+10% a los bonos de runas.',                             'enchantment_amp',   0.10,  1200, 700, 500, 120, 'magic_3');
