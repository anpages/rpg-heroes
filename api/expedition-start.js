import { createClient } from '@supabase/supabase-js'
import { getEffectiveStats } from './_stats.js'

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

  // Obtener héroe y verificar que pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, level, status, player_id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe ya está en una expedición' })

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

  // Aplicar bonus del taller (−5% duración por nivel, mín 50%)
  const { data: workshop } = await supabase
    .from('buildings')
    .select('level')
    .eq('player_id', user.id)
    .eq('type', 'workshop')
    .maybeSingle()

  const workshopLevel = workshop?.level ?? 1
  const workshopReduction = Math.min(0.5, (workshopLevel - 1) * 0.05)

  // Agilidad reduce duración (hasta −25%)
  const stats = await getEffectiveStats(supabase, hero.id)
  const agilityReduction = stats ? Math.min(0.25, stats.agility * 0.003) : 0

  const totalReduction = Math.min(0.70, workshopReduction + agilityReduction)
  const effectiveDuration = Math.round(dungeon.duration_minutes * (1 - totalReduction))

  // Calcular duración y recompensas
  const endsAt = new Date(Date.now() + effectiveDuration * 60 * 1000)
  const goldEarned = Math.floor(dungeon.gold_min + Math.random() * (dungeon.gold_max - dungeon.gold_min))
  const woodEarned = Math.floor(dungeon.wood_min + Math.random() * (dungeon.wood_max - dungeon.wood_min))
  const manaEarned = Math.floor(dungeon.mana_min + Math.random() * (dungeon.mana_max - dungeon.mana_min))

  // Crear expedición
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

  if (expError) return res.status(500).json({ error: expError.message })

  // Poner héroe en estado exploring
  await supabase
    .from('heroes')
    .update({ status: 'exploring' })
    .eq('id', hero.id)

  return res.status(200).json({ ok: true, endsAt })
}
