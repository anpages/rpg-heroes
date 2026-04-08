import { requireAuth } from './_auth.js'
import { snapshotResources } from './_validate.js'
import {
  computeBaseLevel,
  TRAINING_ROOM_BUILD_COST,
  TRAINING_ROOM_BUILD_TIME_MS,
  TRAINING_ROOM_BASE_LEVEL_REQUIRED,
} from '../src/lib/gameConstants.js'
import { TRAINING_ROOM_STATS } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { stat } = req.body
  if (!stat || !TRAINING_ROOM_STATS.includes(stat)) return res.status(400).json({ error: 'Stat inválido' })

  // Verificar nivel de base requerido
  const requiredLevel = TRAINING_ROOM_BASE_LEVEL_REQUIRED[stat] ?? 1
  if (requiredLevel > 1) {
    const { data: buildings } = await supabase
      .from('buildings')
      .select('type, level, unlocked')
      .eq('player_id', user.id)
    const baseLevel = computeBaseLevel(buildings ?? [])
    if (baseLevel < requiredLevel) {
      return res.status(403).json({ error: `Necesitas base nivel ${requiredLevel} para construir esta sala` })
    }
  }

  // Comprobar que la sala no existe ya
  const { data: existing } = await supabase
    .from('training_rooms')
    .select('stat')
    .eq('player_id', user.id)
    .eq('stat', stat)
    .maybeSingle()

  if (existing) return res.status(409).json({ error: 'Esta sala ya está construida o en construcción' })

  // Verificar y descontar recursos (con interpolación idle)
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('iron, wood, mana, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (resourcesError || !resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const snap = snapshotResources(resources)

  if (snap.wood < TRAINING_ROOM_BUILD_COST.wood) return res.status(402).json({ error: 'Madera insuficiente' })
  if (snap.iron < TRAINING_ROOM_BUILD_COST.iron) return res.status(402).json({ error: 'Hierro insuficiente' })

  const { error: updateErr } = await supabase
    .from('resources')
    .update({
      wood: snap.wood - TRAINING_ROOM_BUILD_COST.wood,
      iron: snap.iron - TRAINING_ROOM_BUILD_COST.iron,
      mana: snap.mana,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  const endsAt = new Date(snap.nowMs + TRAINING_ROOM_BUILD_TIME_MS).toISOString()

  const { error: insertErr } = await supabase
    .from('training_rooms')
    .insert({
      player_id:        user.id,
      stat,
      level:            1,
      built_at:         null,          // null = en construcción; se rellena al collect
      building_ends_at: endsAt,
    })

  if (insertErr) return res.status(500).json({ error: insertErr.message })

  return res.status(200).json({ ok: true, stat, endsAt })
}
