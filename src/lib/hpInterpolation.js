/**
 * Interpola los HP del héroe en el cliente según el tiempo transcurrido.
 *
 * @param {object} hero
 * @param {number} nowMs           - timestamp actual (Date.now())
 * @param {number} [effectiveMaxHp] - max_hp efectivo (base + equipo + cartas).
 *                                    Si se omite, usa hero.max_hp.
 */
export function interpolateHp(hero, nowMs, effectiveMaxHp) {
  if (!hero) return 0
  const maxHp       = effectiveMaxHp ?? hero.max_hp
  const lastMs      = hero.hp_last_updated_at ? new Date(hero.hp_last_updated_at).getTime() : nowMs
  const elapsedMin  = Math.max(0, (nowMs - lastMs) / 60000)
  const regenPerMin = hero.status === 'exploring' ? 0 : (100 / 60)
  const regen       = elapsedMin * regenPerMin * hero.max_hp / 100
  return Math.min(maxHp, Math.floor(hero.current_hp + regen))
}
