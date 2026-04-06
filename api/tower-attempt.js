import { createClient } from '@supabase/supabase-js'
import { getEffectiveStats } from './_stats.js'
import { simulateCombat, floorEnemyStats, floorRewards } from './_combat.js'
import { progressMissions } from './_missions.js'
import { rollItemDrop, floorToDifficulty } from './_loot.js'
import { interpolateHP, canPlay } from './_hp.js'
import { isUUID, safeMinutes } from './_validate.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { heroId } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Obtener héroe y verificar que pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, status, experience, level, current_hp, max_hp, hp_last_updated_at')
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
  const heroStats = await getEffectiveStats(supabase, hero.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats del héroe' })

  // Stats del enemigo
  const enemyStats = floorEnemyStats(targetFloor)

  // Simular combate
  const result = simulateCombat(heroStats, enemyStats)
  const won = result.winner === 'a'

  // Registrar intento con log completo para replay
  const { data: heroRow } = await supabase.from('heroes').select('name').eq('id', hero.id).single()
  await supabase.from('tower_attempts').insert({
    hero_id:       hero.id,
    floor:         targetFloor,
    won,
    rounds:        result.rounds,
    hero_hp_left:  result.hpLeftA,
    enemy_hp_left: result.hpLeftB,
    log:           result.log,
    hero_name:     heroRow?.name ?? null,
    enemy_name:    `Piso ${targetFloor}`,
    hero_max_hp:   heroStats.max_hp,
    enemy_max_hp:  enemyStats.max_hp,
  })

  // Deducir HP del combate — daño proporcional al simulado vs max_hp del héroe
  const damageTaken = heroStats.max_hp - result.hpLeftA
  const hpAfterCombat = Math.max(0, currentHp - damageTaken)
  const heroKnockedOut = hpAfterCombat === 0
  await supabase
    .from('heroes')
    .update({
      current_hp:          hpAfterCombat,
      hp_last_updated_at:  new Date(nowMs).toISOString(),
      ...(heroKnockedOut && { status: 'idle' }),
    })
    .eq('id', hero.id)

  let rewards = null

  if (won) {
    // Actualizar progreso
    await supabase
      .from('tower_progress')
      .update({ max_floor: targetFloor, updated_at: new Date().toISOString() })
      .eq('hero_id', hero.id)

    rewards = floorRewards(targetFloor)

    // Dar recompensas: oro — interpolar idle antes de sumar
    const { data: resources } = await supabase
      .from('resources')
      .select('gold, gold_rate, last_collected_at')
      .eq('player_id', user.id)
      .single()

    if (resources) {
      const nowMs = Date.now()
      const currentGold = Math.floor(resources.gold + resources.gold_rate * safeMinutes(resources.last_collected_at, nowMs))
      await supabase
        .from('resources')
        .update({ gold: currentGold + rewards.gold, last_collected_at: new Date(nowMs).toISOString() })
        .eq('player_id', user.id)
    }

    // Dar XP
    const newXp = hero.experience + rewards.experience
    const xpForLevel = hero.level * 150
    const levelUp = newXp >= xpForLevel

    await supabase
      .from('heroes')
      .update({
        experience: levelUp ? newXp - xpForLevel : newXp,
        level: levelUp ? hero.level + 1 : hero.level,
      })
      .eq('id', hero.id)

    rewards.levelUp = levelUp

    // Drop de item — probabilidad escala con el floor
    const difficulty = floorToDifficulty(targetFloor)
    const poolKey = targetFloor % 2 === 0 ? 'tower_even' : 'tower_odd'
    const drop = await rollItemDrop(supabase, hero.id, user.id, { difficulty, poolKey })
    rewards.drop = drop ?? null
  }

  // Progreso de misiones (siempre, gane o no)
  await progressMissions(supabase, user.id, 'tower_attempt', 1)

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
    knockedOut: heroKnockedOut,
  })
}
