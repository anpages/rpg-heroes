import { createClient } from '@supabase/supabase-js'

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

  const { expeditionId } = req.body
  if (!expeditionId) return res.status(400).json({ error: 'expeditionId requerido' })

  // Obtener expedición con héroe
  const { data: expedition } = await supabase
    .from('expeditions')
    .select('*, heroes!inner(id, player_id, experience, level)')
    .eq('id', expeditionId)
    .single()

  if (!expedition) return res.status(404).json({ error: 'Expedición no encontrada' })
  if (expedition.heroes.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (new Date(expedition.ends_at) > new Date()) return res.status(409).json({ error: 'La expedición aún no ha terminado' })
  if (expedition.status === 'completed') return res.status(409).json({ error: 'Las recompensas ya fueron recogidas' })

  const heroId = expedition.heroes.id

  // Añadir recursos al jugador
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, wood, mana')
    .eq('player_id', user.id)
    .single()

  await supabase
    .from('resources')
    .update({
      gold: resources.gold + (expedition.gold_earned ?? 0),
      wood: resources.wood + (expedition.wood_earned ?? 0),
      mana: resources.mana + (expedition.mana_earned ?? 0),
      last_collected_at: new Date().toISOString(),
    })
    .eq('player_id', user.id)

  // Añadir experiencia al héroe (y subir nivel si corresponde)
  const newXp = expedition.heroes.experience + (expedition.experience_earned ?? 0)
  const xpForLevel = expedition.heroes.level * 150
  const levelUp = newXp >= xpForLevel

  await supabase
    .from('heroes')
    .update({
      status: 'idle',
      experience: levelUp ? newXp - xpForLevel : newXp,
      level: levelUp ? expedition.heroes.level + 1 : expedition.heroes.level,
    })
    .eq('id', heroId)

  // Marcar expedición como completada
  await supabase
    .from('expeditions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', expeditionId)

  return res.status(200).json({
    ok: true,
    rewards: {
      gold: expedition.gold_earned,
      wood: expedition.wood_earned,
      mana: expedition.mana_earned,
      experience: expedition.experience_earned,
    },
    levelUp,
  })
}
