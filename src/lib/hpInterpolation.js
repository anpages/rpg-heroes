/**
 * Interpola los HP del héroe en el cliente según el tiempo transcurrido.
 *
 * Debe mantenerse sincronizado con api/_hp.js::interpolateHP
 *
 * Mientras el héroe está exploring (expedición/cámara), la regen se mantiene
 * a cero hasta llegar a status_ends_at. A partir de ese momento la regen se
 * reanuda automáticamente aunque el jugador aún no haya recogido.
 *
 * @param {object} hero
 * @param {number} nowMs           - timestamp actual (Date.now())
 * @param {number} [effectiveMaxHp] - max_hp efectivo (base + equipo + cartas).
 *                                    Si se omite, usa hero.max_hp.
 */
export function interpolateHp(hero, nowMs, effectiveMaxHp) {
  if (!hero) return 0
  const maxHp = effectiveMaxHp ?? hero.max_hp

  let regenFromMs
  if (hero.status === 'exploring') {
    regenFromMs = hero.status_ends_at ? new Date(hero.status_ends_at).getTime() : nowMs
  } else {
    regenFromMs = hero.hp_last_updated_at ? new Date(hero.hp_last_updated_at).getTime() : nowMs
  }
  const elapsedMin = Math.max(0, (nowMs - regenFromMs) / 60000)
  const regen      = elapsedMin * (100 / 60) * hero.max_hp / 100
  return Math.min(maxHp, Math.floor(hero.current_hp + regen))
}
