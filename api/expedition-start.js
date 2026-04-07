import { createClient } from '@supabase/supabase-js'
import { getEffectiveStats } from './_stats.js'
import { interpolateHP, expeditionHpDamage } from './_hp.js'
import { agilityDurationFactor } from '../src/lib/gameFormulas.js'
import { isUUID } from './_validate.js'

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

  const { dungeonId, heroId } = req.body
  if (!dungeonId) return res.status(400).json({ error: 'dungeonId requerido' })
  if (!heroId)    return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(dungeonId)) return res.status(400).json({ error: 'dungeonId inválido' })
  if (!isUUID(heroId))    return res.status(400).json({ error: 'heroId inválido' })

  // Obtener héroe y verificar que pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, level, status, player_id, current_hp, max_hp, hp_last_updated_at')
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

  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs)

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

  // Taller: +5% de botín por nivel (no afecta duración)
  const { data: workshop } = await supabase
    .from('buildings')
    .select('level')
    .eq('player_id', user.id)
    .eq('type', 'workshop')
    .maybeSingle()

  const workshopLevel = workshop?.level ?? 1
  const workshopBonus = 1 + (workshopLevel - 1) * 0.05

  // Agilidad reduce duración (hasta −25%)
  const stats = await getEffectiveStats(supabase, hero.id, user.id)
  const effectiveDuration = Math.round(dungeon.duration_minutes * (stats ? agilityDurationFactor(stats.agility) : 1))

  // Calcular duración y recompensas (taller amplifica el botín)
  const endsAt = new Date(Date.now() + effectiveDuration * 60 * 1000)
  const goldEarned = Math.floor((dungeon.gold_min + Math.random() * (dungeon.gold_max - dungeon.gold_min)) * workshopBonus)
  // Madera, hierro y maná solo se producen en edificios — las expediciones solo dan oro e items
  const woodEarned = 0
  const manaEarned = 0

  // Deducir HP por peligro de la expedición al iniciar
  // La dificultad aumenta el coste; la fuerza del héroe lo reduce
  const hpDamage = expeditionHpDamage(hero.max_hp, dungeon.duration_minutes, dungeon.difficulty, stats?.strength)
  if (currentHp <= hpDamage) {
    return res.status(409).json({
      error: `HP insuficiente. Esta expedición cuesta ${hpDamage} HP y tienes ${currentHp}.`,
      code: 'LOW_HP',
    })
  }
  const hpAfterExpedition = Math.max(1, currentHp - hpDamage)

  // Reclamar el héroe atómicamente: solo actualiza si sigue en idle.
  // Evita la condición de carrera donde dos peticiones simultáneas ambas
  // pasan la comprobación de status pero solo una debe continuar.
  const { data: claimed, error: claimError } = await supabase
    .from('heroes')
    .update({
      status:             'exploring',
      current_hp:         hpAfterExpedition,
      hp_last_updated_at: new Date(nowMs).toISOString(),
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
    // Rollback: restaurar estado idle si la expedición no se pudo crear
    await supabase
      .from('heroes')
      .update({ status: 'idle', current_hp: currentHp, hp_last_updated_at: hero.hp_last_updated_at })
      .eq('id', hero.id)
    return res.status(500).json({ error: expError.message })
  }

  return res.status(200).json({ ok: true, endsAt, hpDamage, heroCurrentHp: hpAfterExpedition })
}
