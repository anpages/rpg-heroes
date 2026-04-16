-- Catálogo de logros
CREATE TABLE achievements_catalog (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  description      text NOT NULL,
  icon             text NOT NULL,
  category         text NOT NULL, -- progression | tower | expeditions | tactics | equipment
  condition_type   text NOT NULL, -- heroes_unlocked | hero_level | base_level | tower_floor | expeditions_complete | tactics_collection | tactic_max_level | item_rarity_equipped
  condition_value  integer NOT NULL,
  reward_gold      integer NOT NULL DEFAULT 0,
  reward_fragments integer NOT NULL DEFAULT 0,
  reward_essence   integer NOT NULL DEFAULT 0,
  reward_scroll    integer NOT NULL DEFAULT 0,
  sort_order       integer NOT NULL DEFAULT 0
);

ALTER TABLE achievements_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_catalog_read" ON achievements_catalog FOR SELECT USING (true);

-- Progreso por jugador
CREATE TABLE player_achievements (
  player_id      uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES achievements_catalog(id),
  completed      boolean NOT NULL DEFAULT false,
  claimed        boolean NOT NULL DEFAULT false,
  completed_at   timestamptz,
  PRIMARY KEY (player_id, achievement_id)
);

ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_achievements_own" ON player_achievements FOR ALL USING (player_id = auth.uid());

-- ── Catálogo inicial ──────────────────────────────────────────────────────────

INSERT INTO achievements_catalog (id, name, description, icon, category, condition_type, condition_value, reward_gold, reward_fragments, reward_essence, reward_scroll, sort_order) VALUES

-- Progresión
('first_hero',      'Primer Héroe',           'Recluta tu primer héroe.',                          '🦸', 'progression', 'heroes_unlocked',    1,  200,  0, 0, 0, 100),
('three_heroes',    'Grupo de Élite',          'Desbloquea 3 héroes.',                              '⚔️', 'progression', 'heroes_unlocked',    3,  500, 20, 0, 0, 101),
('all_heroes',      'Leyenda Viviente',        'Desbloquea los 5 héroes.',                          '👑', 'progression', 'heroes_unlocked',    5, 1000, 50, 0, 0, 102),
('hero_level_10',   'Aprendiz Avanzado',       'Sube un héroe a nivel 10.',                         '📈', 'progression', 'hero_level',        10,  300,  0, 0, 0, 103),
('hero_level_25',   'Veterano',                'Sube un héroe a nivel 25.',                         '⭐', 'progression', 'hero_level',        25,  600, 30, 0, 0, 104),
('hero_level_50',   'Maestro de la Guerra',    'Sube un héroe a nivel 50.',                         '💫', 'progression', 'hero_level',        50, 1500,  0, 1, 0, 105),
('base_level_5',    'Fortaleza',               'Alcanza el nivel de base 5.',                       '🏰', 'progression', 'base_level',         5,  500, 25, 0, 0, 106),
('base_level_10',   'Ciudadela',               'Alcanza el nivel de base 10.',                      '🗼', 'progression', 'base_level',        10, 1500,  0, 2, 0, 107),

-- Torre
('tower_10',        'Escalador',               'Alcanza el piso 10 de la Torre.',                   '🗼', 'tower',       'tower_floor',       10,  400,  0, 0, 0, 200),
('tower_25',        'Explorador de las Alturas','Alcanza el piso 25 de la Torre.',                  '🌩️', 'tower',       'tower_floor',       25,  800, 30, 0, 0, 201),
('tower_50',        'Conquistador',             'Alcanza el piso 50 de la Torre.',                  '⚡', 'tower',       'tower_floor',       50, 1500,  0, 1, 0, 202),
('tower_100',       'Inmortal',                'Alcanza el piso 100 de la Torre.',                  '🌟', 'tower',       'tower_floor',      100, 3000,  0, 3, 0, 203),

-- Expediciones
('exp_10',          'Aventurero',              'Completa 10 expediciones.',                         '🗺️', 'expeditions', 'expeditions_complete', 10,  300,  0, 0, 0, 300),
('exp_50',          'Explorador',              'Completa 50 expediciones.',                         '🧭', 'expeditions', 'expeditions_complete', 50,  700, 30, 0, 0, 301),
('exp_100',         'Gran Explorador',         'Completa 100 expediciones.',                        '🏕️', 'expeditions', 'expeditions_complete',100, 1200, 60, 0, 0, 302),
('exp_500',         'Leyenda Expedicionaria',  'Completa 500 expediciones.',                        '🌍', 'expeditions', 'expeditions_complete',500, 3000,  0, 2, 0, 303),

-- Tácticas
('tactics_5',       'Estratega',               'Consigue 5 tácticas diferentes.',                   '📜', 'tactics',     'tactics_collection',  5,  300,  0, 0, 0, 400),
('tactics_20',      'Táctico Experto',         'Consigue 20 tácticas diferentes.',                  '📚', 'tactics',     'tactics_collection', 20,  700, 30, 0, 0, 401),
('tactics_50',      'Maestro Táctico',         'Consigue 50 tácticas diferentes.',                  '🎖️', 'tactics',     'tactics_collection', 50, 1500,  0, 1, 0, 402),
('tactic_lvl5',     'Pergamino Maestro',       'Sube una táctica al nivel 5.',                      '📝', 'tactics',     'tactic_max_level',   5,  600,  0, 0, 1, 403),
('tactic_mastery',  'Maestría',                'Consigue una táctica de Maestría ★.',               '★',  'tactics',     'tactic_max_level',   6, 1500,  0, 2, 0, 404),

-- Equipo
('first_rare',      'Buscador de Reliquias',   'Equipa tu primer ítem Raro.',                       '💎', 'equipment',   'item_rarity_equipped', 1,  300,  0, 0, 0, 500),
('first_epic',      'Cazador de Épicos',       'Equipa tu primer ítem Épico.',                      '🔮', 'equipment',   'item_rarity_equipped', 2,  700, 30, 0, 0, 501),
('first_legendary', 'Portador de Leyenda',     'Equipa tu primer ítem Legendario.',                 '✨', 'equipment',   'item_rarity_equipped', 3, 1500,  0, 1, 0, 502);
