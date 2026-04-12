import { requireAuth } from './_auth.js'
import { trainingRoomUpgradeCost, trainingRoomUpgradeDurationMs, TRAINING_ROOM_MAX_LEVEL } from '../src/lib/gameConstants.js'
import { TRAINING_ROOM_STATS } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { stat } = req.body
  if (!stat || !TRAINING_ROOM_STATS.includes(stat)) return res.status(400).json({ error: 'Stat inválido' })

  // Obtener nivel actual
  const { data: room, error: roomError } = await supabase
    .from('training_rooms')
    .select('level, built_at, building_ends_at')
    .eq('player_id', user.id)
    .eq('stat', stat)
    .single()

  if (roomError || !room) return res.status(404).json({ error: 'Sala no construida' })
  if (!room.built_at) return res.status(409).json({ error: 'La sala aún está en construcción' })
  if (room.level >= TRAINING_ROOM_MAX_LEVEL) return res.status(409).json({ error: `Nivel máximo alcanzado (${TRAINING_ROOM_MAX_LEVEL})` })
  if (room.building_ends_at && new Date(room.building_ends_at) > new Date()) {
    return res.status(409).json({ error: 'Ya hay una mejora en curso' })
  }

  // Verificar que no hay otra sala de entrenamiento en construcción/mejora
  const queueNow = new Date().toISOString()
  const { data: busyRooms } = await supabase
    .from('training_rooms').select('stat').eq('player_id', user.id).gt('building_ends_at', queueNow).limit(1)
  if (busyRooms?.length > 0) {
    return res.status(409).json({ error: 'Ya hay una sala en construcción' })
  }

  const cost = trainingRoomUpgradeCost(room.level)

  // Deducir recursos (atómico via RPC)
  const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', {
    p_player_id: user.id, p_wood: cost.wood, p_iron: cost.iron,
  })
  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  if (!ok) return res.status(402).json({ error: 'Recursos insuficientes' })

  const endsAt = new Date(Date.now() + trainingRoomUpgradeDurationMs(room.level)).toISOString()

  const { error: upgradeErr } = await supabase
    .from('training_rooms')
    .update({ building_ends_at: endsAt })
    .eq('player_id', user.id)
    .eq('stat', stat)

  if (upgradeErr) return res.status(500).json({ error: upgradeErr.message })

  return res.status(200).json({ ok: true, stat, endsAt })
}
