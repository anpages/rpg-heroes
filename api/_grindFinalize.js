/**
 * Lógica post-combate de grindeo compartida entre grind-combat.js y combat-resume.js.
 */
import { COMBAT_HP_COST } from '../src/lib/gameConstants.js'
import { applyCombatHpCost } from './_hp.js'
import { rollItemDrop, rollTacticDrop, getDropConfig } from './_loot.js'

function grindDropDifficulty(level) {
  if (level <= 5)  return 2
  if (level <= 12) return 4
  if (level <= 20) return 6
  if (level <= 30) return 7
  return 8
}

export async function finalizeGrindCombat({
  supabase,
  user,
  hero,
  currentHp,
  heroStats,
  enemyStats,
  enemyName,
  result,
  nowMs,
  kmCooldownNext,  // valor de grind_km_cooldown a escribir
}) {
  const won = result.winner === 'a'

  const costPct       = won ? COMBAT_HP_COST.grind.win : COMBAT_HP_COST.grind.loss
  const hpAfterCombat = applyCombatHpCost(currentHp, heroStats.max_hp, costPct)

  const { error: hpError, count: hpCount } = await supabase
    .from('heroes')
    .update({
      current_hp:          hpAfterCombat,
      hp_last_updated_at:  new Date(nowMs).toISOString(),
      grind_km_cooldown:   kmCooldownNext,
    })
    .eq('id', hero.id)
    .eq('status', 'idle')

  if (hpError)       return { error: hpError.message, status: 500 }
  if (hpCount === 0) return { error: 'El héroe cambió de estado durante el combate', status: 409 }

  await supabase.rpc('reduce_equipment_durability_scaled', { p_hero_id: hero.id, amount: 1 })

  const gold = won
    ? 20 + Math.floor(Math.random() * 21)
    : 5  + Math.floor(Math.random() * 8)
  const xp = won
    ? 30 + Math.floor(Math.random() * 21)
    : 10 + Math.floor(Math.random() * 11)

  const { data: rpcResult, error: rpcError } = await supabase.rpc('reward_gold_and_xp', {
    p_player_id: user.id,
    p_hero_id:   hero.id,
    p_gold:      gold,
    p_xp:        xp,
  })
  if (rpcError) return { error: rpcError.message, status: 500 }

  let fragments = 0, drop = null, tactic = null

  if (won) {
    if (Math.random() < 0.15) {
      fragments = 1 + Math.floor(Math.random() * 3)
      await supabase.rpc('add_resources', { p_player_id: user.id, p_gold: 0, p_fragments: fragments, p_essence: 0 })
    }
    const dropDif  = grindDropDifficulty(hero.level)
    const dropMult = 0.15 / getDropConfig(dropDif).chance
    drop = await rollItemDrop(supabase, hero.id, user.id, {
      difficulty: dropDif, poolKey: 'combat', heroClass: hero.class, dropRateMult: dropMult,
    })
    if (Math.random() < 0.08) {
      tactic = await rollTacticDrop(supabase, hero.id, hero.class, { chance: 1.0 })
    }
  }

  await supabase.from('combat_log').insert({
    hero_id: hero.id, player_id: user.id, source: 'grind', won, enemy_name: enemyName, rounds: result.rounds,
  })
  await supabase.rpc('increment_combat_stats', { p_hero_id: hero.id, p_won: won })

  return {
    payload: {
      ok: true,
      won,
      rounds:       result.rounds,
      log:          result.log,
      heroHpLeft:   result.hpLeftA,
      enemyHpLeft:  result.hpLeftB,
      heroMaxHp:    heroStats.max_hp,
      enemyMaxHp:   enemyStats.max_hp,
      enemyName,
      heroClass:    hero.class,
      rewards: {
        gold,
        experience: xp,
        fragments:  fragments || null,
        drop:       drop ?? null,
        tactic:     tactic ?? null,
        levelUp:    rpcResult?.level_up ?? false,
      },
      heroCurrentHp: hpAfterCombat,
      heroRealMaxHp: hero.max_hp,
    },
  }
}
