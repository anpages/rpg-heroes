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
