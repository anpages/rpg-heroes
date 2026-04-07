import { createClient } from '@supabase/supabase-js'
import { safeHours } from './_validate.js'
import { trainingRoomUpgradeCost, trainingRoomUpgradeDurationMs, TRAINING_ROOM_MAX_LEVEL } from '../src/lib/gameConstants.js'

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

  const nowMs   = Date.now()
  const hours   = safeHours(resources.last_collected_at, nowMs)
  const curIron = Math.floor(resources.iron + resources.iron_rate * hours)
  const curWood = Math.floor(resources.wood + resources.wood_rate * hours)
  const curMana = Math.floor(resources.mana + resources.mana_rate * hours)

  if (curWood < cost.wood) return res.status(402).json({ error: 'Madera insuficiente' })
  if (curIron < cost.iron) return res.status(402).json({ error: 'Hierro insuficiente' })

  const { error: updateResourcesErr } = await supabase
    .from('resources')
    .update({
      wood: curWood - cost.wood,
      iron: curIron - cost.iron,
      mana: curMana,
      last_collected_at: new Date(nowMs).toISOString(),
    })
    .eq('player_id', user.id)

  if (updateResourcesErr) return res.status(500).json({ error: updateResourcesErr.message })

  const endsAt = new Date(nowMs + trainingRoomUpgradeDurationMs(room.level)).toISOString()

  const { error: upgradeErr } = await supabase
    .from('training_rooms')
    .update({ building_ends_at: endsAt })
    .eq('player_id', user.id)
    .eq('stat', stat)

  if (upgradeErr) return res.status(500).json({ error: upgradeErr.message })

  return res.status(200).json({ ok: true, stat, endsAt })
}
