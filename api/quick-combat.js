import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { simulateCombat } from './_combat.js'
import { trainingEnemyStats, trainingEnemyName, trainingRewards, xpRequiredForLevel } from '../src/lib/gameFormulas.js'
import { interpolateHP, canPlay } from './_hp.js'
import { isUUID, snapshotResources } from './_validate.js'
import { progressMissions } from './_missions.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at, active_effects, class')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe está ocupado' })

  // Verificar HP mínimo (20%)
  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs)
  if (!canPlay(currentHp, hero.max_hp)) {
    return res.status(409).json({
      error: `HP insuficiente. Necesitas al menos ${Math.floor(hero.max_hp * 0.2)} HP para combatir.`,
      code: 'LOW_HP',
    })
  }

  // Stats efectivas del héroe
  const heroStats = await getEffectiveStats(supabase, hero.id, user.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats del héroe' })

  // Aplicar boosts de pociones activas
  const effects = hero.active_effects ?? {}
  if (effects.atk_boost) heroStats.attack  = Math.round(heroStats.attack  * (1 + effects.atk_boost))
  if (effects.def_boost) heroStats.defense = Math.round(heroStats.defense * (1 + effects.def_boost))
  const usedBoosts = Object.fromEntries(
    ['atk_boost', 'def_boost'].filter(k => effects[k]).map(k => [k, effects[k]])
  )

  // Bonos de investigación
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  // Generar enemigo escalado al nivel del héroe
  const enemyStats = trainingEnemyStats(hero.level)
  const enemyName  = trainingEnemyName(hero.level)

  // Simular combate
  const result = simulateCombat(heroStats, enemyStats, {
    critBonus: rb.crit_pct,
    dmgMultiplier: rb.tower_dmg_pct,
  })
  const won = result.winner === 'a'

  // Registrar combate
  const rewards = trainingRewards(hero.level)
  await supabase.from('training_combats').insert({
    hero_id:      hero.id,
    won,
    rounds:       result.rounds,
    log:          result.log,
    hero_name:    hero.name,
    enemy_name:   enemyName,
    hero_max_hp:  heroStats.max_hp,
    enemy_max_hp: enemyStats.max_hp,
    gold_reward:  won ? rewards.gold : 0,
    xp_reward:    won ? rewards.experience : 0,
  })

  // Deducir HP — sin pérdida de durabilidad
  const damageTaken   = heroStats.max_hp - result.hpLeftA
  const hpAfterCombat = Math.max(0, currentHp - damageTaken)
  const heroKnockedOut = hpAfterCombat === 0

  // Limpiar boosts usados
  const newEffects = { ...effects }
  Object.keys(usedBoosts).forEach(k => delete newEffects[k])

  const { error: hpError, count: hpCount } = await supabase
    .from('heroes')
    .update({
      current_hp:         hpAfterCombat,
      hp_last_updated_at: new Date(nowMs).toISOString(),
      active_effects:     newEffects,
      ...(heroKnockedOut && { status: 'idle' }),
    })
    .eq('id', hero.id)
    .eq('status', 'idle')

  if (hpError) return res.status(500).json({ error: hpError.message })
  if (hpCount === 0) return res.status(409).json({ error: 'El héroe cambió de estado durante el combate' })

  // Recompensas solo si gana
  if (won) {
    // Oro
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

    // XP
    const newXp = hero.experience + rewards.experience
    const xpForLevel = xpRequiredForLevel(hero.level)
    const levelUp = newXp >= xpForLevel

    await supabase
      .from('heroes')
      .update({
        experience: levelUp ? newXp - xpForLevel : newXp,
        level: levelUp ? hero.level + 1 : hero.level,
      })
      .eq('id', hero.id)

    rewards.levelUp = levelUp
  }

  // Misiones
  progressMissions(supabase, user.id, 'training_combat', 1).catch(() => {})

  return res.status(200).json({
    ok: true,
    won,
    rounds:       result.rounds,
    log:          result.log,
    heroHpLeft:   result.hpLeftA,
    enemyHpLeft:  result.hpLeftB,
    heroMaxHp:    heroStats.max_hp,
    enemyMaxHp:   enemyStats.max_hp,
    enemyName,
    rewards:      won ? rewards : null,
    heroCurrentHp:  hpAfterCombat,
    heroRealMaxHp:  hero.max_hp,
    knockedOut:     heroKnockedOut,
  })
}
