/**
 * Fórmulas de juego compartidas entre frontend y backend.
 * ÚNICA fuente de verdad — importar desde aquí, nunca duplicar.
 *
 * Backend: import desde '../../src/lib/gameFormulas.js'
 * Frontend: import desde '../lib/gameFormulas.js'
 */

/**
 * Coste de HP de una expedición.
 * - Base: 20% del max_hp por hora (proporcional a la duración).
 * - Peligro escala el coste (hasta +45% en dificultad 9).
 * - Fuerza lo reduce (hasta −40% con fuerza 100).
 */
export function expeditionHpCost(maxHp, durationMinutes, difficulty = 0, strength = 0) {
  const base             = (maxHp ?? 100) * durationMinutes / 300
  const dangerMult       = 1 + (difficulty ?? 0) * 0.05
  const strengthReduct   = Math.max(0.6, 1 - (strength ?? 0) * 0.004)
  return Math.max(1, Math.floor(base * dangerMult * strengthReduct))
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
 * Bonus de una carta de habilidad en rango `rank`.
 * Escala linealmente: baseValue × rank.
 */
export function cardBonusAtRank(baseValue, rank) {
  return baseValue * rank
}

/**
 * Penalización de una carta de habilidad en rango `rank`.
 * Crece más despacio que el bonus: baseValue × (1 + (rank−1) × 0.5).
 * Rango 1 → ×1.0, Rango 2 → ×1.5, Rango 3 → ×2.0, Rango 4 → ×2.5, Rango 5 → ×3.0.
 *
 * No incluye Math.round — el llamador redondea si trabaja con enteros.
 * Para stats de porcentaje (ej. weapon_attack_amp = 0.15) no se redondea.
 */
export function cardPenaltyAtRank(baseValue, rank) {
  return baseValue * (1 + (rank - 1) * 0.5)
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
