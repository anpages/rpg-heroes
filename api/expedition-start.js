import { createClient } from '@supabase/supabase-js'
import { getEffectiveStats } from './_stats.js'
import { interpolateHP, canPlay, expeditionHpDamage } from './_hp.js'
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

  // Verificar HP mínimo (20%)
  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs)
  if (!canPlay(currentHp, hero.max_hp)) {
    return res.status(409).json({
      error: `HP insuficiente. Necesitas al menos ${Math.floor(hero.max_hp * 0.2)} HP para explorar.`,
      code: 'LOW_HP',
    })
  }

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
  const stats = await getEffectiveStats(supabase, hero.id)
  const agilityReduction = stats ? Math.min(0.25, stats.agility * 0.003) : 0
  const effectiveDuration = Math.round(dungeon.duration_minutes * (1 - agilityReduction))

  // Calcular duración y recompensas (taller amplifica el botín)
  const endsAt = new Date(Date.now() + effectiveDuration * 60 * 1000)
  const goldEarned = Math.floor((dungeon.gold_min + Math.random() * (dungeon.gold_max - dungeon.gold_min)) * workshopBonus)
  const woodEarned = Math.floor((dungeon.wood_min + Math.random() * (dungeon.wood_max - dungeon.wood_min)) * workshopBonus)
  const manaEarned = Math.floor((dungeon.mana_min + Math.random() * (dungeon.mana_max - dungeon.mana_min)) * workshopBonus)

  // Deducir HP por peligro de la expedición al iniciar
  const hpDamage = expeditionHpDamage(hero.max_hp, dungeon.difficulty)
  const hpAfterExpedition = Math.max(1, currentHp - hpDamage) // mínimo 1 (no knock out en expedición)

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
