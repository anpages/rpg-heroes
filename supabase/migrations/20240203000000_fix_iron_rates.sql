-- Recalcular rates para todos los jugadores con edificios activos
-- Misma lógica que computeRates() en building-upgrade-collect.js

WITH building_levels AS (
  SELECT
    player_id,
    COALESCE(MAX(CASE WHEN type='energy_nexus' AND unlocked THEN level END), 0) AS nexus,
    COALESCE(MAX(CASE WHEN type='gold_mine'    AND unlocked THEN level END), 0) AS mine,
    COALESCE(MAX(CASE WHEN type='lumber_mill'  AND unlocked THEN level END), 0) AS lumber,
    COALESCE(MAX(CASE WHEN type='mana_well'    AND unlocked THEN level END), 0) AS mana_w
  FROM buildings
  GROUP BY player_id
),
rates AS (
  SELECT
    player_id,
    CASE WHEN mine   > 0 THEN ROUND((0.5 + (mine   - 1) * 0.3)::numeric * LEAST(1.0, CASE WHEN (mine+lumber+mana_w)*10 > 0 THEN nexus*30.0/((mine+lumber+mana_w)*10) ELSE 1 END), 2) ELSE 0 END AS iron_rate,
    CASE WHEN lumber > 0 THEN ROUND((0.3 + (lumber - 1) * 0.2)::numeric * LEAST(1.0, CASE WHEN (mine+lumber+mana_w)*10 > 0 THEN nexus*30.0/((mine+lumber+mana_w)*10) ELSE 1 END), 2) ELSE 0 END AS wood_rate,
    CASE WHEN mana_w > 0 THEN ROUND((0.2 + (mana_w - 1) * 0.15)::numeric * LEAST(1.0, CASE WHEN (mine+lumber+mana_w)*10 > 0 THEN nexus*30.0/((mine+lumber+mana_w)*10) ELSE 1 END), 2) ELSE 0 END AS mana_rate
  FROM building_levels
)
UPDATE resources r
SET
  iron_rate = rates.iron_rate,
  wood_rate = rates.wood_rate,
  mana_rate = rates.mana_rate,
  gold_rate = 0
FROM rates
WHERE r.player_id = rates.player_id;
