/**
 * HP interpolation utilities.
 *
 * HP regenerates passively over time when the hero is idle:
 *   idle      → 100% of max_hp per hour (full recovery from 0 in ~1h)
 *   exploring → no regeneration (in combat)
 *
 * Minimum HP to play: 20% of max_hp
 */

export const REGEN_IDLE_PCT_PER_MIN = 100 / 60  // 100%/hr → per minute
export const MIN_HP_PCT             = 0.20       // 20% of max_hp required to play

/**
 * Calculate current HP including passive regeneration since hp_last_updated_at.
 * @param {object} hero - must have current_hp, max_hp, status, hp_last_updated_at
 * @param {number} nowMs - current timestamp in ms
 * @returns {number} current HP (capped at max_hp)
 */
export function interpolateHP(hero, nowMs) {
  const lastMs = hero.hp_last_updated_at
    ? new Date(hero.hp_last_updated_at).getTime()
    : nowMs
  const elapsedMin   = Math.max(0, (nowMs - lastMs) / 30000)
  const regenPerMin  = hero.status === 'exploring' ? 0 : REGEN_IDLE_PCT_PER_MIN
  const regen        = elapsedMin * regenPerMin * hero.max_hp / 100
  return Math.min(hero.max_hp, Math.floor(hero.current_hp + regen))
}

/**
 * Whether the hero has enough HP to enter combat or expeditions.
 */
export function canPlay(currentHp, maxHp) {
  return currentHp >= Math.floor(maxHp * MIN_HP_PCT)
}

// Fórmula compartida con el frontend — no duplicar aquí
export { expeditionHpCost as expeditionHpDamage } from '../src/lib/gameFormulas.js'
