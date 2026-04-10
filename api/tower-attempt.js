import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { simulateCombat, floorEnemyStats, floorRewards, floorEnemyName } from './_combat.js'
import { xpRequiredForLevel } from '../src/lib/gameFormulas.js'
import { progressMissions } from './_missions.js'
import { rollItemDrop, floorToDifficulty } from './_loot.js'
import { interpolateHP, canPlay, applyCombatHpCost } from './_hp.js'
import { isUUID, snapshotResources } from './_validate.js'
import { COMBAT_HP_COST } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Obtener héroe y verificar que pertenece al jugador
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

  // Obtener o inicializar progreso en la torre
  let { data: progress } = await supabase
    .from('tower_progress')
    .select('max_floor')
    .eq('hero_id', hero.id)
    .maybeSingle()

  if (!progress) {
    await supabase.from('tower_progress').insert({ hero_id: hero.id, max_floor: 0 })
    progress = { max_floor: 0 }
  }

  const targetFloor = progress.max_floor + 1

  // Stats efectivas del héroe
  const heroStats = await getEffectiveStats(supabase, hero.id, user.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats del héroe' })

  // Aplicar boosts de pociones activas (atk_boost / def_boost)
  const effects = hero.active_effects ?? {}
  if (effects.atk_boost) heroStats.attack  = Math.round(heroStats.attack  * (1 + effects.atk_boost))
  if (effects.def_boost) heroStats.defense = Math.round(heroStats.defense * (1 + effects.def_boost))
  const usedBoosts = Object.fromEntries(
    ['atk_boost', 'def_boost'].filter(k => effects[k]).map(k => [k, effects[k]])
  )

  // Bonos de investigación para combate
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  // Stats del enemigo
  const enemyStats = floorEnemyStats(targetFloor)

  // Simular combate — aplicar crit_pct y tower_dmg_pct
  const result = simulateCombat(heroStats, enemyStats, {
    critBonus: rb.crit_pct,
    dmgMultiplier: rb.tower_dmg_pct,
  })
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
    enemy_name:    floorEnemyName(targetFloor),
    hero_max_hp:   heroStats.max_hp,
    enemy_max_hp:  enemyStats.max_hp,
  })

  // Deducir HP — coste plano fijo, gane o pierda. El combate ya se simuló
  // sobre max_hp del héroe, así que el HP actual solo limita cuántas
  // actividades caben en una sesión, no afecta a la fuerza del duelo.
  const costPct       = won ? COMBAT_HP_COST.tower.win : COMBAT_HP_COST.tower.loss
  const hpAfterCombat = applyCombatHpCost(currentHp, hero.max_hp, costPct)

  // Limpiar boosts usados de active_effects
  const newEffects = { ...effects }
  Object.keys(usedBoosts).forEach(k => delete newEffects[k])

  const { error: hpError, count: hpCount } = await supabase
    .from('heroes')
    .update({
      current_hp:          hpAfterCombat,
      hp_last_updated_at:  new Date(nowMs).toISOString(),
      active_effects:      newEffects,
    })
    .eq('id', hero.id)
    .eq('status', 'idle')

  if (hpError) return res.status(500).json({ error: hpError.message })
  if (hpCount === 0) return res.status(409).json({ error: 'El héroe cambió de estado durante el combate' })

  // Reducir durabilidad del equipo — escala con el piso, siempre (gane o pierda)
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

    if (progressError) return res.status(500).json({ error: progressError.message })

    rewards = floorRewards(targetFloor)

    // Dar recompensas: oro — interpolar idle antes de sumar
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

      if (resError) return res.status(500).json({ error: resError.message })
    }

    // Dar XP
    const newXp = hero.experience + rewards.experience
    const xpForLevel = xpRequiredForLevel(hero.level)
    const levelUp = newXp >= xpForLevel

    const { error: xpError } = await supabase
      .from('heroes')
      .update({
        experience: levelUp ? newXp - xpForLevel : newXp,
        level: levelUp ? hero.level + 1 : hero.level,
      })
      .eq('id', hero.id)

    if (xpError) return res.status(500).json({ error: xpError.message })

    rewards.levelUp = levelUp

    // Drop de item — probabilidad escala con el floor
    const difficulty = floorToDifficulty(targetFloor)
    const poolKey = targetFloor % 2 === 0 ? 'tower_even' : 'tower_odd'
    const drop = await rollItemDrop(supabase, hero.id, user.id, { difficulty, poolKey, dropRateBonus: heroStats.itemDropRateBonus ?? 0, heroClass: hero.class })
    rewards.drop = drop ?? null
  }

  // Progreso de misiones (no bloquea la respuesta)
  progressMissions(supabase, user.id, 'tower_attempt', 1).catch(e => console.error('mission error:', e.message))

  return res.status(200).json({
    ok: true,
    won,
    floor: targetFloor,
    rounds: result.rounds,
    log: result.log,
    heroHpLeft: result.hpLeftA,
    enemyHpLeft: result.hpLeftB,
    heroMaxHp: heroStats.max_hp,
    enemyMaxHp: enemyStats.max_hp,
    maxFloor: won ? targetFloor : progress.max_floor,
    rewards,
    heroCurrentHp: hpAfterCombat,
    heroRealMaxHp: hero.max_hp,
  })
}
