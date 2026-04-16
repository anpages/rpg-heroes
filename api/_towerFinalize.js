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
import { COMBAT_HP_COST, towerWearForFloor } from '../src/lib/gameConstants.js'
import { applyCombatHpCost } from './_hp.js'
import { floorRewards } from './_combat.js'

import { progressMissions } from './_missions.js'

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

  // Limpiar boosts usados de active_effects + tower_shield (se consume en este intento)
  const effects    = hero.active_effects ?? {}
  const newEffects = { ...effects }
  Object.keys(usedBoosts ?? {}).forEach(k => delete newEffects[k])
  delete newEffects.tower_shield

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

  // Reducir durabilidad del equipo — escala con el piso (helper centralizado).
  // tower_shield (ya eliminado de newEffects arriba) reduce la pérdida de durabilidad.
  const towerShield = effects.tower_shield ?? 0
  const durLossFloor = Math.max(1, Math.round(towerWearForFloor(targetFloor) * (1 - towerShield)))
  const { error: durError } = await supabase.rpc('reduce_equipment_durability_scaled', { p_hero_id: hero.id, amount: durLossFloor })
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

    // Oro + XP atómico con level-up (transacción SQL)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('reward_gold_and_xp', {
      p_player_id: user.id,
      p_hero_id:   hero.id,
      p_gold:      rewards.gold,
      p_xp:        rewards.experience,
    })
    if (rpcError) return { error: rpcError.message, status: 500 }
    rewards.levelUp = rpcResult?.level_up ?? false
    // Items y tácticas solo se consiguen en expediciones, no en la torre
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
      heroClass: hero.class,
      maxFloor: won ? targetFloor : prevMaxFloor,
      rewards,
      heroCurrentHp: hpAfterCombat,
      heroRealMaxHp: hero.max_hp,
    },
  }
}
