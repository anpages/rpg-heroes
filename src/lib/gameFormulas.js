/**
 * Fórmulas de juego compartidas entre frontend y backend.
 * ÚNICA fuente de verdad — importar desde aquí, nunca duplicar.
 *
 * Backend: import desde '../../src/lib/gameFormulas.js'
 * Frontend: import desde '../lib/gameFormulas.js'
 */

/**
 * Coste de HP de una expedición.
 * Tasa: 20% del max_hp por hora (proporcional a la duración).
 */
export function expeditionHpCost(maxHp, durationMinutes) {
  return Math.max(1, Math.floor((maxHp ?? 100) * durationMinutes / 300))
}

/**
 * Reducción de duración por agilidad (hasta −25%).
 */
export function agilityDurationFactor(agility) {
  return 1 - Math.min(0.25, (agility ?? 0) * 0.003)
}

/**
 * Multiplicador de oro y XP por ataque (hasta +100%).
 * Usado en expedition-collect y en el display de DungeonCard.
 */
export function attackMultiplier(attack) {
  return 1 + Math.min(1.0, (attack ?? 0) * 0.008)
}

/**
 * Stats del enemigo de un piso de la torre.
 */
export function floorEnemyStats(floor) {
  return {
    max_hp:       80  + floor * 15,
    attack:        5  + floor * 2,
    defense:       2  + floor * 1,
    strength:      2  + Math.floor(floor * 0.5),
    agility:       2  + Math.floor(floor * 0.3),
    intelligence:  1  + Math.floor(floor * 0.3),
  }
}

/**
 * Recompensas por superar un piso de la torre.
 */
export function floorRewards(floor) {
  const milestone = floor % 5 === 0
  return {
    gold:       Math.round((30 + floor * 15) * (milestone ? 2 : 1)),
    experience: Math.round((20 + floor * 10) * (milestone ? 2 : 1)),
    milestone,
  }
}
