import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import {
  computeBaseLevel,
  buildingUpgradeCost,
  buildingUpgradeDurationMs,
  LAB_BASE_LEVEL_REQUIRED,
  BUILDING_MAX_LEVEL,
} from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { buildingId } = req.body
  if (!buildingId) return res.status(400).json({ error: 'buildingId requerido' })
  if (!isUUID(buildingId)) return res.status(400).json({ error: 'buildingId inválido' })

  const { data: building } = await supabase
    .from('buildings')
    .select('*')
    .eq('id', buildingId)
    .single()

  if (!building) return res.status(404).json({ error: 'Edificio no encontrado' })
  if (building.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (!building.unlocked) return res.status(403).json({ error: 'Este edificio no está desbloqueado todavía' })
  if (building.level >= BUILDING_MAX_LEVEL) return res.status(409).json({ error: `Nivel máximo alcanzado (${BUILDING_MAX_LEVEL})` })
  if (building.upgrade_ends_at && new Date(building.upgrade_ends_at) > new Date()) {
    return res.status(409).json({ error: 'El edificio ya está mejorando' })
  }

  // Solo se puede mejorar un edificio a la vez
  const { data: busyBuildings } = await supabase
    .from('buildings')
    .select('id')
    .eq('player_id', user.id)
    .gt('upgrade_ends_at', new Date().toISOString())
    .limit(1)

  if (busyBuildings?.length > 0) {
    return res.status(409).json({ error: 'Ya hay un edificio en construcción. Espera a que termine.' })
  }

  // Laboratorio: requiere nivel de base ≥ 2
  if (building.type === 'laboratory') {
    const { data: allBuildings } = await supabase
      .from('buildings').select('type, level, unlocked').eq('player_id', user.id)
    const baseLevel = computeBaseLevel(allBuildings ?? [])
    if (baseLevel < LAB_BASE_LEVEL_REQUIRED) {
      return res.status(403).json({ error: `Necesitas base nivel ${LAB_BASE_LEVEL_REQUIRED} para construir el Laboratorio` })
    }
  }

  const cost       = buildingUpgradeCost(building.type, building.level)
  const durationMs = buildingUpgradeDurationMs(building.level)

  const { data: resources } = await supabase
    .from('resources')
    .select('wood, iron, mana, wood_rate, iron_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const snap = snapshotResources(resources)

  if (cost.wood && snap.wood < cost.wood) return res.status(409).json({ error: `Madera insuficiente (necesitas ${cost.wood})` })
  if (cost.iron && snap.iron < cost.iron) return res.status(409).json({ error: `Hierro insuficiente (necesitas ${cost.iron})` })
  if (cost.mana && snap.mana < cost.mana) return res.status(409).json({ error: `Maná insuficiente (necesitas ${cost.mana})` })

  const endsAt = new Date(snap.nowMs + durationMs).toISOString()

  // Descontar recursos (snapshot en este momento)
  const { error: resourcesError } = await supabase
    .from('resources')
    .update({
      wood: snap.wood - (cost.wood ?? 0),
      iron: snap.iron - (cost.iron ?? 0),
      mana: snap.mana - (cost.mana ?? 0),
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)

  if (resourcesError) return res.status(500).json({ error: resourcesError.message })

  // Iniciar mejora
  const { error: buildingError } = await supabase
    .from('buildings')
    .update({ upgrade_started_at: snap.nowIso, upgrade_ends_at: endsAt })
    .eq('id', buildingId)

  if (buildingError) return res.status(500).json({ error: buildingError.message })

  return res.status(200).json({ ok: true, endsAt })
}
