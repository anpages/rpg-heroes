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
  // Pisos 1-25: crecimiento lineal normal.
  // Pisos 26+: crecimiento a mitad de ritmo para que el late-game sea alcanzable.
  const cap = 25
  const slow = Math.max(0, floor - cap)
  const fast = Math.min(floor, cap)
  return {
    max_hp:      80  + fast * 15 + slow * 8,
    attack:       5  + fast * 2  + slow * 1,
    defense:      2  + fast * 1  + Math.floor(slow * 0.5),
    strength:     2  + Math.floor(fast * 0.5) + Math.floor(slow * 0.25),
    agility:      2  + Math.floor(fast * 0.3) + Math.floor(slow * 0.15),
    intelligence: 1  + Math.floor(fast * 0.3) + Math.floor(slow * 0.15),
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
 * XP necesaria para subir del nivel `level` al `level + 1`.
 * Fuente de verdad única — usada en frontend y en todos los endpoints de API.
 */
export function xpRequiredForLevel(level) {
  return level * 150
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

/**
 * Nombre del enemigo para un piso de la torre.
 * Determinista: mismo piso → mismo nombre.
 */
const ENEMY_POOLS = [
  { max:  5, names: ['Bandido Renegado', 'Saqueador Orco', 'Goblin Feroz', 'Troll Bruto', 'Merodeador Oscuro'] },
  { max: 10, names: ['Centinela de Hierro', 'Vigía Implacable', 'Patrullero Maldito', 'Mercenario Cruel', 'Guardaespaldas Corrupto'] },
  { max: 20, names: ['Campeón Maldito', 'Berserker de Sangre', 'Cazador de Élite', 'Coloso de Piedra', 'Invocador de Sombras'] },
  { max: 50, names: ['Señor de la Guerra', 'Archimago Oscuro', 'Inquisidor de Hierro', 'Ejecutor Implacable', 'Tirano Eterno', 'Forjador de Almas'] },
  { max: Infinity, names: ['Ángel Caído', 'Archidemon', 'El Eterno', 'Señor de las Sombras', 'El Destructor', 'Dios de la Ruina', 'El Sin Nombre'] },
]

export function floorEnemyName(floor) {
  const pool = ENEMY_POOLS.find(p => floor <= p.max)?.names ?? ENEMY_POOLS[ENEMY_POOLS.length - 1].names
  return pool[floor % pool.length]
}
