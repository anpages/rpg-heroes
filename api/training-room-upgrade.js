import { requireAuth } from './_auth.js'
import { snapshotResources } from './_validate.js'
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

  const cost = trainingRoomUpgradeCost(room.level)

  // Verificar y descontar recursos
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('iron, wood, mana, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (resourcesError || !resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const snap = snapshotResources(resources)

  if (snap.wood < cost.wood) return res.status(402).json({ error: 'Madera insuficiente' })
  if (snap.iron < cost.iron) return res.status(402).json({ error: 'Hierro insuficiente' })

  const { error: updateResourcesErr } = await supabase
    .from('resources')
    .update({
      wood: snap.wood - cost.wood,
      iron: snap.iron - cost.iron,
      mana: snap.mana,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)

  if (updateResourcesErr) return res.status(500).json({ error: updateResourcesErr.message })

  const endsAt = new Date(snap.nowMs + trainingRoomUpgradeDurationMs(room.level)).toISOString()

  const { error: upgradeErr } = await supabase
    .from('training_rooms')
    .update({ building_ends_at: endsAt })
    .eq('player_id', user.id)
    .eq('stat', stat)

  if (upgradeErr) return res.status(500).json({ error: upgradeErr.message })

  return res.status(200).json({ ok: true, stat, endsAt })
}
