import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { simulateCombat } from './_combat.js'
import { interpolateHP, canPlay, applyCombatHpCost } from './_hp.js'
import { isUUID } from './_validate.js'
import { progressMissions } from './_missions.js'
import { COMBAT_HP_COST, WEAR_PROFILE } from '../src/lib/gameConstants.js'
import { computeRatingUpdate, teamCombatDifficulty } from './_rating.js'
import { computeSynergy, applySynergyToStats } from '../src/lib/teamSynergy.js'
import { trainingRewards } from '../src/lib/gameFormulas.js'
import { verifyCombatToken } from './_combatSign.js'
import { generateEnemyTactics } from './_enemyTactics.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { previewToken, heroIds, matchups } = req.body ?? {}

  if (!previewToken)                               return res.status(400).json({ error: 'previewToken requerido' })
  if (!Array.isArray(heroIds) || heroIds.length !== 5) return res.status(400).json({ error: 'Debes enviar 5 heroIds' })
  if (!Array.isArray(matchups) || matchups.length !== 5) return res.status(400).json({ error: 'Debes enviar 5 matchups' })
  if (new Set(heroIds).size !== 5)                 return res.status(400).json({ error: 'Los 5 héroes deben ser distintos' })

  for (const id of heroIds) {
    if (!isUUID(id)) return res.status(400).json({ error: 'heroId inválido' })
  }

  const enemyIndices  = matchups.map(m => m.enemyIndex)
  const matchupHeroIds = matchups.map(m => m.heroId)
  if (new Set(enemyIndices).size !== 5 || !enemyIndices.every(i => [0, 1, 2, 3, 4].includes(i))) {
    return res.status(400).json({ error: 'Los matchups deben cubrir los 5 enemigos exactamente una vez' })
  }
  if (new Set(matchupHeroIds).size !== 5 || !matchupHeroIds.every(id => heroIds.includes(id))) {
    return res.status(400).json({ error: 'Los matchups deben cubrir los 5 héroes exactamente una vez' })
  }

  let preview
  try {
    preview = verifyCombatToken(previewToken)
  } catch (e) {
    return res.status(400).json({ error: e.message, code: 'INVALID_PREVIEW' })
  }
  if (preview.type !== 'team5_preview') return res.status(400).json({ error: 'Token de tipo incorrecto' })
  if (preview.userId !== user.id)       return res.status(400).json({ error: 'Token no corresponde al jugador' })

  const { enemies: enemyTeam, avgLevel } = preview

  const { data: heroesRows, error: heroesErr } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at, active_effects, class, combat_rating, combats_played, combats_won, last_combat_at, tier_grace_remaining')
    .in('id', heroIds)
    .eq('player_id', user.id)

  if (heroesErr) return res.status(500).json({ error: heroesErr.message })
  if (!heroesRows || heroesRows.length !== 5) return res.status(404).json({ error: 'Uno o más héroes no encontrados' })

  const heroesById = Object.fromEntries(heroesRows.map(h => [h.id, h]))
  const nowMs = Date.now()

  const effectiveStats = {}
  for (const heroId of heroIds) {
    const hero = heroesById[heroId]
    if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
    if (hero.status !== 'idle') return res.status(409).json({ error: `${hero.name} está ocupado` })

    const stats = await getEffectiveStats(supabase, heroId, user.id)
    if (!stats) return res.status(500).json({ error: `Sin stats para ${hero.name}` })

    const curHp = interpolateHP(hero, nowMs, stats.max_hp)
    if (!canPlay(curHp, stats.max_hp)) {
      return res.status(409).json({ error: `${hero.name} tiene HP insuficiente (20% mín.)`, code: 'LOW_HP' })
    }
    effectiveStats[heroId] = stats
  }

  const heroObjects   = heroIds.map(id => heroesById[id])
  const playerSynergy = computeSynergy(heroObjects.map(h => h.class))

  const duels = []
  let playerWins = 0

  for (const { heroId, enemyIndex } of matchups) {
    const hero   = heroesById[heroId]
    const enemy  = enemyTeam[enemyIndex]
    const base   = effectiveStats[heroId]
    const heroStats = applySynergyToStats({ ...base }, playerSynergy)
    heroStats.max_hp = base.max_hp

    const enemyTactics = generateEnemyTactics(avgLevel, enemy.archetypeKey)

    const duelResult = simulateCombat(heroStats, enemy.stats, {
      classA:   hero.class,
      classB:   enemy.archetypeKey,
      tacticsB: enemyTactics,
    })

    const duelWon = duelResult.winner === 'a'
    if (duelWon) playerWins++

    duels.push({
      heroId,
      heroName:    hero.name,
      heroClass:   hero.class,
      heroMaxHp:   heroStats.max_hp,
      heroHpLeft:  duelResult.hpLeftA,
      enemyIndex,
      enemyName:   enemy.name,
      enemyClass:  enemy.class,
      enemyMaxHp:  enemy.stats.max_hp,
      enemyHpLeft: duelResult.hpLeftB,
      won:         duelWon,
      rounds:      duelResult.rounds,
    })
  }

  const won   = playerWins >= 3
  const score = `${playerWins}-${5 - playerWins}`

  // Recompensas: ×5 oro, ×2 XP por héroe
  const base       = trainingRewards(avgLevel)
  const goldReward = Math.round(base.gold * 5.0)
  const xpPerHero  = Math.round(base.experience * 2.0)

  await supabase.from('team_combats').insert({
    player_id:     user.id,
    hero_ids:      heroIds,
    hero_names:    heroObjects.map(h => h.name),
    hero_classes:  heroObjects.map(h => h.class),
    hero_max_hps:  heroIds.map(id => effectiveStats[id].max_hp),
    enemy_names:   enemyTeam.map(e => e.name),
    enemy_classes: enemyTeam.map(e => e.class),
    enemy_max_hps: enemyTeam.map(e => e.stats.max_hp),
    won,
    rounds:        Math.max(...duels.map(d => d.rounds)),
    log:           duels.map(d => ({ heroId: d.heroId, heroName: d.heroName, enemyName: d.enemyName, won: d.won })),
    gold_reward:   won ? goldReward : 0,
    xp_reward:     won ? xpPerHero  : 0,
    synergy_bonus: playerSynergy.attackPct,
  })

  const costPct   = won ? COMBAT_HP_COST.squad.win : COMBAT_HP_COST.squad.loss
  const nowIso    = new Date(nowMs).toISOString()
  const ratingMap = {}

  for (const heroId of heroIds) {
    const hero    = heroesById[heroId]
    const effMax  = effectiveStats[heroId].max_hp
    const curHp   = interpolateHP(hero, nowMs, effMax)
    const hpAfter = applyCombatHpCost(curHp, hero.max_hp, costPct)

    const ratingResult = computeRatingUpdate(hero, { won, difficulty: teamCombatDifficulty(), nowMs })
    ratingMap[heroId] = ratingResult

    const { error } = await supabase
      .from('heroes')
      .update({ current_hp: hpAfter, hp_last_updated_at: nowIso, ...ratingResult.updates })
      .eq('id', heroId)
      .eq('status', 'idle')

    if (error) return res.status(500).json({ error: error.message })
  }

  for (const heroId of heroIds) {
    supabase.rpc('reduce_equipment_durability_scaled', { p_hero_id: heroId, amount: WEAR_PROFILE.squad })
      .then(({ error }) => { if (error) console.error('durability error:', error.message) })
  }

  if (won) {
    for (let i = 0; i < heroIds.length; i++) {
      await supabase.rpc('reward_gold_and_xp', {
        p_player_id: user.id,
        p_hero_id:   heroIds[i],
        p_gold:      i === 0 ? goldReward : 0,
        p_xp:        xpPerHero,
      })
    }
  }

  progressMissions(supabase, user.id, 'training_combat', 1).catch(() => {})

  return res.status(200).json({
    ok: true,
    won,
    score,
    playerWins,
    duels,
    synergy: { player: playerSynergy },
    rewards: won ? { gold: goldReward, xpPerHero } : null,
    ratings: heroIds.map(id => {
      const r    = ratingMap[id]
      const hero = heroesById[id]
      return {
        heroId:   id,
        heroName: hero.name,
        prev:     r.tierBefore.rating,
        current:  r.updates.combat_rating,
        delta:    r.delta,
        promoted: r.promoted,
        tier:     r.tierAfter.tier,
        division: r.tierAfter.division,
        label:    r.tierAfter.label,
      }
    }),
  })
}
