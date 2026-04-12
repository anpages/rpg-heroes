/**
 * Lógica post-combate del torneo, extraída para que pueda ser invocada
 * tanto desde /api/tournament-fight (combate normal) como desde
 * /api/combat-resume (reanudación tras Momento clave).
 */
import { COMBAT_HP_COST, WEAR_PROFILE } from '../src/lib/gameConstants.js'
import { applyCombatHpCost } from './_hp.js'
import { xpRequiredForLevel } from '../src/lib/gameFormulas.js'
import { tournamentRoundRewards } from './_tournament.js'
import { computeRatingUpdate, tournamentDifficulty } from './_rating.js'
import { rollTacticDrop } from './_loot.js'

export async function finalizeTournamentFight({
  supabase,
  user,
  hero,
  heroStats,
  rival,
  bracket,
  nextRound,
  result,
  currentHp,
  newEffects,
  nowMs,
}) {
  const won      = result.winner === 'a'
  const champion = won && nextRound === 3

  // Coste plano de HP
  const costPct       = won ? COMBAT_HP_COST.tournament.win : COMBAT_HP_COST.tournament.loss
  const hpAfterCombat = applyCombatHpCost(currentHp, hero.max_hp, costPct)

  // Rating de combate
  const { data: ratingRow } = await supabase
    .from('heroes')
    .select('combat_rating, combats_played, combats_won, last_combat_at, tier_grace_remaining')
    .eq('id', hero.id)
    .single()

  const ratingResult = ratingRow
    ? computeRatingUpdate(ratingRow, {
        won,
        difficulty: tournamentDifficulty(nextRound),
        nowMs,
      })
    : null

  await supabase
    .from('heroes')
    .update({
      active_effects:     newEffects,
      current_hp:         hpAfterCombat,
      hp_last_updated_at: new Date(nowMs).toISOString(),
      ...(ratingResult?.updates ?? {}),
    })
    .eq('id', hero.id)

  // Desgaste del equipo — escalado por ronda (2/3/4). La función SQL escalada
  // aplica rareza × slot encima del amount nominal. Entre ronda y ronda hay
  // dos días para que el jugador repare o mejore equipo, ese es el punto.
  const tournamentWear = WEAR_PROFILE.tournament[nextRound] ?? WEAR_PROFILE.tournament[3]
  const { error: durError } = await supabase.rpc('reduce_equipment_durability_scaled', { p_hero_id: hero.id, amount: tournamentWear })
  if (durError) console.error('durability rpc error:', durError.message)

  // Actualizar bracket
  await supabase
    .from('tournament_brackets')
    .update({
      current_round: won ? nextRound : bracket.current_round,
      eliminated:    !won,
      champion,
    })
    .eq('id', bracket.id)

  let rewards = null
  if (won) {
    rewards = tournamentRoundRewards(nextRound, champion)
    await supabase.rpc('add_resources', { p_player_id: user.id, p_gold: rewards.gold })

    const newXp      = hero.experience + rewards.experience
    const xpForLevel = xpRequiredForLevel(hero.level)
    const levelUp    = newXp >= xpForLevel
    await supabase
      .from('heroes')
      .update({
        experience: levelUp ? newXp - xpForLevel : newXp,
        level:      levelUp ? hero.level + 1 : hero.level,
      })
      .eq('id', hero.id)
    rewards.levelUp = levelUp

    // Táctica garantizada al ganar el torneo (100% chance)
    if (champion) {
      const tacticDrop = await rollTacticDrop(supabase, hero.id, hero.class, { chance: 1.0 })
      if (tacticDrop) rewards.tactic = tacticDrop.tactic ?? tacticDrop
    }
  }

  // Guardar match
  await supabase.from('tournament_matches').insert({
    bracket_id:   bracket.id,
    round:        nextRound,
    won,
    log:          result.log,
    rewards:      rewards ?? null,
    hero_max_hp:  heroStats.max_hp,
    rival_max_hp: rival.stats.max_hp,
  })

  return {
    payload: {
      ok: true, won, round: nextRound, champion,
      eliminated: !won,
      log:          result.log,
      heroMaxHp:    heroStats.max_hp,
      rivalMaxHp:   rival.stats.max_hp,
      rival, rewards, heroClass: hero.class,
      heroCurrentHp: hpAfterCombat,
      heroRealMaxHp: hero.max_hp,
      rating: ratingResult ? {
        prev:      ratingResult.tierBefore.rating,
        current:   ratingResult.updates.combat_rating,
        delta:     ratingResult.delta,
        decay:     ratingResult.decayApplied,
        graceUsed: ratingResult.graceUsed,
        promoted:  ratingResult.promoted,
        tier:      ratingResult.tierAfter.tier,
        division:  ratingResult.tierAfter.division,
        label:     ratingResult.tierAfter.label,
      } : null,
    },
  }
}
