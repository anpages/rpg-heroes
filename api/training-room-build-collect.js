import { requireAuth } from './_auth.js'
import { TRAINING_ROOM_STATS } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { stat } = req.body
  if (!stat || !TRAINING_ROOM_STATS.includes(stat)) return res.status(400).json({ error: 'Stat inválido' })

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
