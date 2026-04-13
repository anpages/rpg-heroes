-- ══════════════════════════════════════════════════════════════════════════════
-- Reducir a 8 mazmorras con tiempos variados (15min → 6h) y drops balanceados
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Cancelar expediciones activas a mazmorras que vamos a eliminar
UPDATE heroes SET status = 'idle', status_ends_at = NULL
WHERE id IN (
  SELECT e.hero_id FROM expeditions e
  JOIN dungeons d ON d.id = e.dungeon_id
  WHERE e.status = 'traveling'
    AND d.name IN ('Ruinas Encantadas', 'Minas de Hierro Oscuro', 'Catacumba Olvidada', 'Veta Arcana', 'Abismo de las Almas')
);

DELETE FROM expeditions
WHERE dungeon_id IN (
  SELECT id FROM dungeons
  WHERE name IN ('Ruinas Encantadas', 'Minas de Hierro Oscuro', 'Catacumba Olvidada', 'Veta Arcana', 'Abismo de las Almas')
);

-- 2. Limpiar modificadores semanales que apunten a mazmorras eliminadas
DELETE FROM weekly_dungeon_modifier
WHERE dungeon_id IN (
  SELECT id FROM dungeons
  WHERE name IN ('Ruinas Encantadas', 'Minas de Hierro Oscuro', 'Catacumba Olvidada', 'Veta Arcana', 'Abismo de las Almas')
);

-- 3. Eliminar las 5 mazmorras sobrantes
DELETE FROM dungeons
WHERE name IN ('Ruinas Encantadas', 'Minas de Hierro Oscuro', 'Catacumba Olvidada', 'Veta Arcana', 'Abismo de las Almas');

-- 4. Actualizar las 8 mazmorras restantes con nuevas duraciones y recompensas

-- Sendero del Bosque: 15min, dif 1, nivel 1 — rápida para cuando tienes tiempo
UPDATE dungeons SET
  difficulty = 1, min_hero_level = 1, duration_minutes = 15,
  gold_min = 15, gold_max = 30, experience_reward = 25,
  description = 'Un sendero tranquilo ideal para incursiones rápidas. Buen rendimiento de oro.'
WHERE name = 'Sendero del Bosque';

-- Cueva de Goblins: 30min, dif 2, nivel 1 — buena para equipo
UPDATE dungeons SET
  difficulty = 2, min_hero_level = 1, duration_minutes = 30,
  gold_min = 35, gold_max = 70, experience_reward = 60,
  description = 'Guarida de goblins repleta de botín. Alta probabilidad de encontrar equipo.'
WHERE name = 'Cueva de Goblins';

-- Altar Corrompido: 60min, dif 3, nivel 3 — buena para tácticas
UPDATE dungeons SET
  difficulty = 3, min_hero_level = 3, duration_minutes = 60,
  gold_min = 70, gold_max = 140, experience_reward = 130,
  description = 'Altar imbuido de energía oscura. Los héroes aprenden tácticas de los rituales grabados.'
WHERE name = 'Altar Corrompido';

-- Mina Abandonada: 90min, dif 4, nivel 4 — fragmentos
UPDATE dungeons SET
  difficulty = 4, min_hero_level = 4, duration_minutes = 90,
  gold_min = 110, gold_max = 220, experience_reward = 200,
  description = 'Mina profunda llena de vetas cristalizadas. Fuente de fragmentos valiosos.'
WHERE name = 'Mina Abandonada';

-- Bosque Oscuro: 120min, dif 5, nivel 5 — XP
UPDATE dungeons SET
  difficulty = 5, min_hero_level = 5, duration_minutes = 120,
  gold_min = 160, gold_max = 320, experience_reward = 300,
  description = 'Bosque ancestral donde cada paso es una prueba. Experiencia excepcional para los valientes.'
WHERE name = 'Bosque Oscuro';

-- Cripta de los Condenados: 180min (3h), dif 6, nivel 7 — fragmentos + equipo
UPDATE dungeons SET
  difficulty = 6, min_hero_level = 7, duration_minutes = 180,
  gold_min = 260, gold_max = 520, experience_reward = 480,
  description = 'Laberinto subterráneo de tumbas olvidadas. Grandes recompensas y fragmentos abundantes.'
WHERE name = 'Cripta de los Condenados';

-- Templo de los Antiguos: 240min (4h), dif 7, nivel 8 — esencia + tácticas
UPDATE dungeons SET
  difficulty = 7, min_hero_level = 8, duration_minutes = 240,
  gold_min = 380, gold_max = 760, experience_reward = 680,
  description = 'Ruinas de una civilización arcana. Esencia pura y conocimientos tácticos perdidos.'
WHERE name = 'Templo de los Antiguos';

-- Guarida del Dragón: 360min (6h), dif 8, nivel 10 — todo al máximo
UPDATE dungeons SET
  difficulty = 8, min_hero_level = 10, duration_minutes = 360,
  gold_min = 600, gold_max = 1200, experience_reward = 1100,
  description = 'La guarida del dragón más temido. Recompensas legendarias para quien sobreviva.'
WHERE name = 'Guarida del Dragón';
