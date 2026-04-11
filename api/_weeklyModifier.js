/**
 * Desafío semanal de mazmorras (per-héroe).
 *
 * Cada héroe tiene su propio desafío de la semana: una mazmorra que ese héroe
 * puede jugar (filtrada por su nivel), con UNO de los modificadores definidos
 * en src/lib/weeklyModifiers.js. La selección es lazy: la primera vez que el
 * backend lo necesita en la semana, se crea la fila.
 *
 * Los multiplicadores se aplican en:
 *   - expedition-start  → durationMult (afecta endsAt), hpDamageMult
 *   - expedition-collect → goldMult, xpMult, dropMult, materialMult
 */

import { WEEKLY_MODIFIERS, getModifierForDungeon, getWeekStart } from '../src/lib/weeklyModifiers.js'

export { WEEKLY_MODIFIERS, getModifierForDungeon, getWeekStart }

const MODIFIER_IDS = Object.keys(WEEKLY_MODIFIERS)

/**
 * Obtiene el modificador semanal activo para un héroe, creándolo si no existe.
 * Filtra dungeons por hero.level → garantiza que el desafío siempre sea jugable.
 *
 * @param {object} supabase - cliente service-role
 * @param {string} heroId   - id del héroe
 * @returns {Promise<{ week_start: string, hero_id: string, dungeon_id: string, modifier_id: string, modifier: object } | null>}
 */
export async function getOrCreateWeeklyModifier(supabase, heroId) {
  if (!heroId) return null
  const weekStart = getWeekStart()

  // 1. Buscar fila existente para este héroe esta semana
  const { data: existing } = await supabase
    .from('weekly_dungeon_modifier')
    .select('week_start, hero_id, dungeon_id, modifier_id')
    .eq('week_start', weekStart)
    .eq('hero_id', heroId)
    .maybeSingle()

  if (existing) {
    return {
      ...existing,
      modifier: WEEKLY_MODIFIERS[existing.modifier_id] ?? null,
    }
  }

  // 2. No existe → leer nivel del héroe y elegir mazmorra accesible
  const { data: hero } = await supabase
    .from('heroes')
    .select('level')
    .eq('id', heroId)
    .maybeSingle()
  if (!hero) return null

  const { data: dungeons } = await supabase
    .from('dungeons')
    .select('id')
    .lte('min_hero_level', hero.level)

  if (!dungeons?.length) return null

  const dungeon    = dungeons[Math.floor(Math.random() * dungeons.length)]
  const modifierId = MODIFIER_IDS[Math.floor(Math.random() * MODIFIER_IDS.length)]

  // 3. Insertar (con onConflict do nothing por si dos peticiones simultáneas crean a la vez)
  const { data: inserted } = await supabase
    .from('weekly_dungeon_modifier')
    .upsert(
      { week_start: weekStart, hero_id: heroId, dungeon_id: dungeon.id, modifier_id: modifierId },
      { onConflict: 'week_start,hero_id', ignoreDuplicates: true }
    )
    .select('week_start, hero_id, dungeon_id, modifier_id')
    .maybeSingle()

  // Si el upsert no devolvió fila (porque ya existía por race), releer
  if (!inserted) {
    const { data: refetched } = await supabase
      .from('weekly_dungeon_modifier')
      .select('week_start, hero_id, dungeon_id, modifier_id')
      .eq('week_start', weekStart)
      .eq('hero_id', heroId)
      .maybeSingle()

    if (!refetched) return null
    return { ...refetched, modifier: WEEKLY_MODIFIERS[refetched.modifier_id] ?? null }
  }

  return { ...inserted, modifier: WEEKLY_MODIFIERS[inserted.modifier_id] ?? null }
}
