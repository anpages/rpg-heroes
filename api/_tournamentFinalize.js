/**
 * Lógica post-combate del torneo, extraída para que pueda ser invocada
 * tanto desde /api/tournament-fight (combate normal) como desde
 * /api/combat-resume (reanudación tras Momento clave).
 */
import { COMBAT_HP_COST } from '../src/lib/gameConstants.js'
import { applyCombatHpCost } from './_hp.js'
import { xpRequiredForLevel } from '../src/lib/gameFormulas.js'
import { tournamentRoundRewards } from './_tournament.js'
import { snapshotResources } from './_validate.js'

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

  await supabase
    .from('heroes')
    .update({
      active_effects:     newEffects,
      current_hp:         hpAfterCombat,
      hp_last_updated_at: new Date(nowMs).toISOString(),
    })
    .eq('id', hero.id)

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
    const { data: resources } = await supabase
      .from('resources')
      .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
      .eq('player_id', user.id)
      .single()

    if (resources) {
      const snap = snapshotResources(resources)
      await supabase
        .from('resources')
        .update({ gold: snap.gold + rewards.gold, iron: snap.iron, wood: snap.wood, mana: snap.mana, last_collected_at: snap.nowIso })
        .eq('player_id', user.id)
    }

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

    // Carta garantizada al ganar el torneo
    if (champion) {
      const { data: cards } = await supabase.from('skill_cards').select('id, name').limit(20)
      if (cards?.length) {
        const card = cards[Math.floor(Math.random() * cards.length)]
        const { data: existing } = await supabase
          .from('hero_cards').select('id, rank').eq('hero_id', hero.id).eq('card_id', card.id).maybeSingle()
        if (existing) {
          await supabase.from('hero_cards').update({ rank: Math.min(20, existing.rank + 1) }).eq('id', existing.id)
        } else {
          await supabase.from('hero_cards').insert({ hero_id: hero.id, card_id: card.id, rank: 1 })
        }
        rewards.card = card
      }
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
      rival, rewards,
      heroCurrentHp: hpAfterCombat,
      heroRealMaxHp: hero.max_hp,
    },
  }
}
