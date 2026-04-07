import { createClient } from '@supabase/supabase-js'

const VALID_STATS = ['strength', 'agility', 'attack', 'defense', 'intelligence']

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

  const { stat } = req.body
  if (!stat || !VALID_STATS.includes(stat)) return res.status(400).json({ error: 'Stat inválido' })

  const { data: room, error: roomError } = await supabase
    .from('training_rooms')
    .select('stat, level, built_at, building_ends_at')
    .eq('player_id', user.id)
    .eq('stat', stat)
    .single()

  if (roomError || !room) return res.status(404).json({ error: 'Sala no encontrada' })
  if (!room.building_ends_at)                                    return res.status(409).json({ error: 'La sala no está en construcción' })
  if (new Date(room.building_ends_at) > new Date())              return res.status(409).json({ error: 'La construcción aún no ha terminado' })

  const isInitialBuild = room.built_at === null

  if (isInitialBuild) {
    // Construcción inicial: activar la sala
    const { error } = await supabase
      .from('training_rooms')
      .update({ built_at: new Date().toISOString(), building_ends_at: null })
      .eq('player_id', user.id)
      .eq('stat', stat)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, stat, level: room.level, action: 'built' })
  } else {
    // Mejora completa: incrementar nivel
    const { error } = await supabase
      .from('training_rooms')
      .update({ level: room.level + 1, building_ends_at: null })
      .eq('player_id', user.id)
      .eq('stat', stat)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, stat, level: room.level + 1, action: 'upgraded' })
  }
}
