/**
 * HP interpolation utilities.
 *
 * HP regenerates passively over time:
 *   idle      → 100%/hr desde hp_last_updated_at
 *   exploring → sin regen mientras la actividad está en curso;
 *               al llegar status_ends_at la regen se reanuda automáticamente
 *               aunque el jugador aún no haya recogido. Así una expedición
 *               nocturna no castiga al jugador idle que vuelve horas más tarde.
 *
 * Minimum HP to play: 20% of max_hp
 */

export const REGEN_IDLE_PCT_PER_MIN = 100 / 60  // 100%/hr → per minute
export const MIN_HP_PCT             = 0.20       // 20% of max_hp required to play

/**
 * Calculate current HP including passive regeneration.
 * @param {object} hero - must have current_hp, max_hp, status, hp_last_updated_at, status_ends_at
 * @param {number} nowMs - current timestamp in ms
 * @param {number} [effectiveMaxHp] - max_hp efectivo (base + equipo + cartas).
 *                                    Si se omite, usa hero.max_hp.
 * @returns {number} current HP (capped at effectiveMaxHp)
 */
export function interpolateHP(hero, nowMs, effectiveMaxHp) {
  const maxHp = effectiveMaxHp ?? hero.max_hp
  let regenFromMs
  if (hero.status === 'exploring') {
    // Regen se reanuda cuando la actividad termina (status_ends_at).
    // Si aún está en curso (status_ends_at > now) o no hay ends_at → 0 regen.
    regenFromMs = hero.status_ends_at
      ? new Date(hero.status_ends_at).getTime()
      : nowMs
  } else {
    regenFromMs = hero.hp_last_updated_at
      ? new Date(hero.hp_last_updated_at).getTime()
      : nowMs
  }
  const elapsedMin = Math.max(0, (nowMs - regenFromMs) / 60000)
  const regen      = elapsedMin * REGEN_IDLE_PCT_PER_MIN * hero.max_hp / 100
  return Math.min(maxHp, Math.floor(hero.current_hp + regen))
}

/**
 * Whether the hero has enough HP to enter combat or expeditions.
 */
export function canPlay(currentHp, maxHp) {
  return currentHp >= Math.floor(maxHp * MIN_HP_PCT)
}

/**
 * Calcula el HP del héroe tras una actividad de combate.
 *
 * El combate se simula sobre max_hp (cada duelo es independiente). Aquí se
 * deduce un coste plano del HP actual: el HP funciona como "energía/fatiga"
 * que limita cuántas actividades caben en una sesión, no como vida del duelo.
 *
 * @param {number} currentHp - HP actual del héroe (tras interpolación)
 * @param {number} maxHp     - max_hp base del héroe
 * @param {number} costPct   - fracción de max_hp a deducir (ej. 0.10 = 10%)
 * @returns {number} HP tras la actividad (mínimo 0)
 */
export function applyCombatHpCost(currentHp, maxHp, costPct) {
  const damage = Math.round(maxHp * costPct)
  return Math.max(0, currentHp - damage)
}

// Fórmula compartida con el frontend — no duplicar aquí
export { expeditionHpCost as expeditionHpDamage } from '../src/lib/gameFormulas.js'
