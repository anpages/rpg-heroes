-- Rebalanceo hierro/madera: hierro es recurso escaso (produce menos que madera)
-- Fórmulas intercambiadas:
--   Hierro: base=0.3, step=0.2 → Nv1=18/h, Nv2=30/h, Nv3=42/h, Nv4=54/h, Nv5=66/h
--   Madera: base=0.5, step=0.3 → Nv1=30/h, Nv2=48/h, Nv3=66/h, Nv4=84/h, Nv5=102/h

WITH building_levels AS (
  SELECT
    player_id,
    COALESCE(MAX(CASE WHEN type = 'energy_nexus' AND unlocked THEN level END), 0) AS nexus,
    COALESCE(MAX(CASE WHEN type = 'gold_mine'    AND unlocked THEN level END), 0) AS mine,
    COALESCE(MAX(CASE WHEN type = 'lumber_mill'  AND unlocked THEN level END), 0) AS lumber,
    COALESCE(MAX(CASE WHEN type = 'mana_well'    AND unlocked THEN level END), 0) AS mana_w
  FROM buildings
  GROUP BY player_id
),
energy AS (
  SELECT
    player_id,
    nexus, mine, lumber, mana_w,
    LEAST(1.0,
      CASE WHEN (mine + lumber + mana_w) * 10 > 0
        THEN nexus * 30.0 / ((mine + lumber + mana_w) * 10)
        ELSE 1.0
      END
    ) AS ratio
  FROM building_levels
)
UPDATE resources r
SET
  iron_rate = CASE WHEN e.mine   > 0 THEN ROUND((0.3 + (e.mine   - 1) * 0.2) * 60 * e.ratio) ELSE 0 END,
  wood_rate = CASE WHEN e.lumber > 0 THEN ROUND((0.5 + (e.lumber - 1) * 0.3) * 60 * e.ratio) ELSE 0 END,
  mana_rate = CASE WHEN e.mana_w > 0 THEN ROUND((0.2 + (e.mana_w - 1) * 0.15) * 60 * e.ratio) ELSE 0 END
FROM energy e
WHERE r.player_id = e.player_id;
