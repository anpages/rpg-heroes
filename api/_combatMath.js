/**
 * Fórmulas puras de combate reutilizables (1v1 y 3v3).
 * Sin estado, sin bucle — solo matemática de daño, crit y orden de ataque.
 *
 * physDamage  = max(1, round((atk + str×0.3) × (1 − def/(def+100))))
 * magicDamage = floor(intelligence × 0.15)  (ignora defensa)
 * critPeriod  = max(5, 10 − floor(agility/10))  rondas entre críticos
 * rollFirstAttacker: prioridad probabilística por diferencia de agility.
 * armorPen   = min(0.30, str × 0.003) — fracción de defensa ignorada
 * variance   = ±15% aleatorio sobre daño final
 */

export function physDamage(atk, str, def) {
  const raw = (atk ?? 0) + Math.floor((str ?? 0) * 0.3)
  const reduction = (def ?? 0) / ((def ?? 0) + 100)
  return Math.max(1, Math.round(raw * (1 - reduction)))
}

export function magicDamage(intel) {
  return Math.floor((intel ?? 0) * 0.15)
}

export function critPeriod(agility) {
  return Math.max(5, 10 - Math.floor((agility ?? 0) / 10))
}

/**
 * Fracción de defensa que la fuerza del atacante ignora.
 * Más STR = más penetración de armadura, hasta un 30%.
 */
export function armorPen(str) {
  return Math.min(0.30, (str ?? 0) * 0.003)
}

/**
 * Aplica varianza aleatoria de ±15% al daño.
 * @param {number} dmg  — daño base
 * @param {Function} rng — generador random (default Math.random)
 * @returns {number}
 */
export function applyVariance(dmg, rng = Math.random) {
  return Math.max(1, Math.round(dmg * (0.85 + rng() * 0.30)))
}

/**
 * Decide quién ataca primero en función de la diferencia de agility.
 *  - Diferencia ≥ 20  → siempre golpea primero el más rápido (skill claro).
 *  - Diferencia 5–20  → 75% favor del rápido, 25% sorpresa del lento.
 *  - Diferencia < 5   → 50/50, completamente abierto.
 */
export function rollFirstAttacker(agiA, agiB, rng = Math.random) {
  const diff = (agiA ?? 0) - (agiB ?? 0)
  const abs  = Math.abs(diff)
  if (abs >= 20) return diff >= 0 ? 'a' : 'b'
  if (abs >= 5) {
    const fasterIsA = diff > 0
    return rng() < 0.75 ? (fasterIsA ? 'a' : 'b') : (fasterIsA ? 'b' : 'a')
  }
  return rng() < 0.5 ? 'a' : 'b'
}
