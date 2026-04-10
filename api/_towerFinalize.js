/**
 * Lógica post-combate de la torre, extraída para que pueda ser invocada
 * tanto desde /api/tower-attempt (combate normal) como desde
 * /api/combat-resume (combate reanudado tras un Momento clave).
 *
 * Recibe el resultado completo del combate (ya simulado) y aplica:
 *   - Inserta tower_attempts (registro replay)
 *   - Deduce HP plano según ganó/perdió
 *   - Reduce durabilidad del equipo
 *   - Si ganó: actualiza progreso, da oro, XP, level up, drop de item
 *   - Progreso de misiones
 *
 * @returns objeto con la respuesta JSON lista para devolver al cliente
 */
import { COMBAT_HP_COST } from '../src/lib/gameConstants.js'
import { applyCombatHpCost } from './_hp.js'
import { floorRewards } from './_combat.js'
import { xpRequiredForLevel } from '../src/lib/gameFormulas.js'
import { rollItemDrop, floorToDifficulty } from './_loot.js'
import { progressMissions } from './_missions.js'
import { snapshotResources } from './_validate.js'

export async function finalizeTowerAttempt({
  supabase,
  user,
  hero,
  currentHp,
  heroStats,
  enemyStats,
  targetFloor,
  enemyName,
  archetypeKey,
  result,
  usedBoosts,
  nowMs,
  prevMaxFloor,
}) {
  const won = result.winner === 'a'

  // Registrar intento con log completo para replay
  await supabase.from('tower_attempts').insert({
    hero_id:       hero.id,
    floor:         targetFloor,
    won,
    rounds:        result.rounds,
    hero_hp_left:  result.hpLeftA,
    enemy_hp_left: result.hpLeftB,
    log:           result.log,
    hero_name:     hero.name,
    enemy_name:    enemyName,
    hero_max_hp:   heroStats.max_hp,
    enemy_max_hp:  enemyStats.max_hp,
  })

  // Deducir HP — coste plano fijo, gane o pierda
  const costPct       = won ? COMBAT_HP_COST.tower.win : COMBAT_HP_COST.tower.loss
  const hpAfterCombat = applyCombatHpCost(currentHp, hero.max_hp, costPct)

  // Limpiar boosts usados de active_effects
  const effects    = hero.active_effects ?? {}
  const newEffects = { ...effects }
  Object.keys(usedBoosts ?? {}).forEach(k => delete newEffects[k])

  const { error: hpError, count: hpCount } = await supabase
    .from('heroes')
    .update({
      current_hp:          hpAfterCombat,
      hp_last_updated_at:  new Date(nowMs).toISOString(),
      active_effects:      newEffects,
    })
    .eq('id', hero.id)
    .eq('status', 'idle')

  if (hpError)      return { error: hpError.message, status: 500 }
  if (hpCount === 0) return { error: 'El héroe cambió de estado durante el combate', status: 409 }

  // Reducir durabilidad del equipo — escala con el piso
  const durLossFloor = targetFloor <= 10 ? 1 : targetFloor <= 25 ? 2 : targetFloor <= 40 ? 3 : 4
  const { error: durError } = await supabase.rpc('reduce_equipment_durability', { p_hero_id: hero.id, amount: durLossFloor })
  if (durError) console.error('durability rpc error:', durError.message)

  let rewards = null

  if (won) {
    // Actualizar progreso
    const { error: progressError } = await supabase
      .from('tower_progress')
      .update({ max_floor: targetFloor, updated_at: new Date().toISOString() })
      .eq('hero_id', hero.id)

    if (progressError) return { error: progressError.message, status: 500 }

    rewards = floorRewards(targetFloor)

    // Oro — interpolar idle antes de sumar
    const { data: resources } = await supabase
      .from('resources')
      .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
      .eq('player_id', user.id)
      .single()

    if (resources) {
      const snap = snapshotResources(resources)
      const { error: resError } = await supabase
        .from('resources')
        .update({ gold: snap.gold + rewards.gold, iron: snap.iron, wood: snap.wood, mana: snap.mana, last_collected_at: snap.nowIso })
        .eq('player_id', user.id)
      if (resError) return { error: resError.message, status: 500 }
    }

    // XP
    const newXp      = hero.experience + rewards.experience
    const xpForLevel = xpRequiredForLevel(hero.level)
    const levelUp    = newXp >= xpForLevel
    const { error: xpError } = await supabase
      .from('heroes')
      .update({
        experience: levelUp ? newXp - xpForLevel : newXp,
        level:      levelUp ? hero.level + 1 : hero.level,
      })
      .eq('id', hero.id)
    if (xpError) return { error: xpError.message, status: 500 }
    rewards.levelUp = levelUp

    // Drop de item
    const difficulty = floorToDifficulty(targetFloor)
    const poolKey    = targetFloor % 2 === 0 ? 'tower_even' : 'tower_odd'
    const drop = await rollItemDrop(supabase, hero.id, user.id, {
      difficulty,
      poolKey,
      dropRateBonus: heroStats.itemDropRateBonus ?? 0,
      heroClass: hero.class,
    })
    rewards.drop = drop ?? null
  }

  // Progreso de misiones
  progressMissions(supabase, user.id, 'tower_attempt', 1).catch(e => console.error('mission error:', e.message))

  return {
    payload: {
      ok: true,
      won,
      floor: targetFloor,
      rounds: result.rounds,
      log: result.log,
      heroHpLeft: result.hpLeftA,
      enemyHpLeft: result.hpLeftB,
      heroMaxHp: heroStats.max_hp,
      enemyMaxHp: enemyStats.max_hp,
      enemyName,
      archetype: archetypeKey,
      maxFloor: won ? targetFloor : prevMaxFloor,
      rewards,
      heroCurrentHp: hpAfterCombat,
      heroRealMaxHp: hero.max_hp,
    },
  }
}
