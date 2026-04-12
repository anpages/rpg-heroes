import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { interpolateHP, expeditionHpDamage } from './_hp.js'
import { agilityDurationFactor } from '../src/lib/gameFormulas.js'
import { isUUID } from './_validate.js'
import { getOrCreateWeeklyModifier, getModifierForDungeon } from './_weeklyModifier.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { dungeonId, heroId } = req.body
  if (!dungeonId) return res.status(400).json({ error: 'dungeonId requerido' })
  if (!heroId)    return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(dungeonId)) return res.status(400).json({ error: 'dungeonId inválido' })
  if (!isUUID(heroId))    return res.status(400).json({ error: 'heroId inválido' })

  // Obtener héroe y verificar que pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, level, status, player_id, current_hp, max_hp, hp_last_updated_at, status_ends_at, active_effects')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe ya está en una expedición' })

  // Verificar slots de expedición simultánea (base: 1 slot, +1 con investigación expedition_slots)
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)
  const maxExpeditions = 1 + rb.expedition_slots

  if (maxExpeditions < 2) {
    // Sin investigación: solo se puede tener 1 expedición activa (comportamiento original)
    // El check de hero.status === 'idle' ya lo cubre arriba
  } else {
    // Con investigación: contar expediciones activas del jugador
    const { count } = await supabase
      .from('expeditions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'traveling')
      .in('hero_id',
        (await supabase.from('heroes').select('id').eq('player_id', user.id)).data?.map(h => h.id) ?? []
      )

    if ((count ?? 0) >= maxExpeditions) {
      return res.status(409).json({ error: `Ya tienes ${maxExpeditions} expedición(es) activa(s)` })
    }
  }

  // Stats efectivas del héroe (antes de interpolar HP para usar max_hp con equipo)
  const stats = await getEffectiveStats(supabase, hero.id, user.id)

  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs, stats?.max_hp)

  // Obtener mazmorra
  const { data: dungeon } = await supabase
    .from('dungeons')
    .select('*')
    .eq('id', dungeonId)
    .single()

  if (!dungeon) return res.status(404).json({ error: 'Mazmorra no encontrada' })
  if (hero.level < dungeon.min_hero_level) {
    return res.status(403).json({ error: `Necesitas nivel ${dungeon.min_hero_level} para entrar aquí` })
  }

  // Modificador semanal: si esta mazmorra es el desafío de la semana del héroe,
  // aplica multiplicadores de duración y de daño HP recibido al iniciar.
  const weekly = await getOrCreateWeeklyModifier(supabase, hero.id)
  const mods = getModifierForDungeon(weekly, dungeonId)

  // Agilidad reduce duración (hasta −25%)
  const baseDuration = dungeon.duration_minutes * (stats ? agilityDurationFactor(stats.agility) : 1)
  // Poción de tiempo activa: reduce la duración en effect_value (ej. 0.40 → −40%).
  // Se aplica sobre el resultado ya ajustado por agilidad y modificador semanal.
  const timeReduction = hero.active_effects?.time_reduction ?? 0
  const effectiveDuration = Math.max(
    1,
    Math.round(baseDuration * mods.durationMult * (1 - timeReduction)),
  )

  const endsAt = new Date(Date.now() + effectiveDuration * 60 * 1000)
  const goldEarned = Math.floor(dungeon.gold_min + Math.random() * (dungeon.gold_max - dungeon.gold_min))
  // Madera, hierro y maná solo se producen en edificios — las expediciones solo dan oro e items
  const woodEarned = 0
  const manaEarned = 0

  // Deducir HP por peligro de la expedición al iniciar
  // La dificultad aumenta el coste; la fuerza del héroe lo reduce
  const baseHpDamage = expeditionHpDamage(hero.max_hp, dungeon.duration_minutes, dungeon.difficulty, stats?.strength)
  const hpDamage = Math.round(baseHpDamage * mods.hpDamageMult)
  if (currentHp <= hpDamage) {
    return res.status(409).json({
      error: `HP insuficiente. Esta expedición cuesta ${hpDamage} HP y tienes ${currentHp}.`,
      code: 'LOW_HP',
    })
  }
  const hpAfterExpedition = Math.max(1, currentHp - hpDamage)

  // Consumir time_reduction si estaba activo. Los demás boosts (xp/loot/gold)
  // se consumen en expedition-collect porque afectan al resultado final.
  const effectsAfter = { ...(hero.active_effects ?? {}) }
  if (timeReduction) delete effectsAfter.time_reduction

  // Reclamar el héroe atómicamente: solo actualiza si sigue en idle.
  // Evita la condición de carrera donde dos peticiones simultáneas ambas
  // pasan la comprobación de status pero solo una debe continuar.
  const { data: claimed, error: claimError } = await supabase
    .from('heroes')
    .update({
      status:             'exploring',
      current_hp:         hpAfterExpedition,
      hp_last_updated_at: new Date(nowMs).toISOString(),
      status_ends_at:     endsAt.toISOString(),
      active_effects:     effectsAfter,
    })
    .eq('id', hero.id)
    .eq('status', 'idle')
    .select('id')

  if (claimError) return res.status(500).json({ error: claimError.message })
  if (!claimed || claimed.length === 0) {
    return res.status(409).json({ error: 'El héroe ya está en una expedición' })
  }

  // Crear expedición (héroe ya está bloqueado en exploring)
  const { error: expError } = await supabase
    .from('expeditions')
    .insert({
      hero_id: hero.id,
      dungeon_id: dungeonId,
      ends_at: endsAt.toISOString(),
      status: 'traveling',
      gold_earned: goldEarned,
      wood_earned: woodEarned,
      mana_earned: manaEarned,
      experience_earned: dungeon.experience_reward,
    })

  if (expError) {
    // Rollback: restaurar estado idle + active_effects originales si la
    // expedición no se pudo crear. Devolvemos la poción de tiempo gastada
    // para que el jugador pueda reintentar sin perderla.
    await supabase
      .from('heroes')
      .update({
        status: 'idle',
        current_hp: currentHp,
        hp_last_updated_at: hero.hp_last_updated_at,
        status_ends_at: null,
        active_effects: hero.active_effects ?? {},
      })
      .eq('id', hero.id)
    return res.status(500).json({ error: expError.message })
  }

  return res.status(200).json({ ok: true, endsAt, hpDamage, heroCurrentHp: hpAfterExpedition })
}
