import { createClient } from '@supabase/supabase-js'
import { isUUID, safeHours } from './_validate.js'
import {
  computeBaseLevel,
  buildingUpgradeCost,
  buildingUpgradeDurationMs,
  LAB_BASE_LEVEL_REQUIRED,
  BUILDING_MAX_LEVEL,
} from '../src/lib/gameConstants.js'

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

  // Calcular recursos actuales con interpolación
  const now = Date.now()
  const hours = safeHours(resources.last_collected_at, now)
  const currentWood = Math.floor(resources.wood + resources.wood_rate * hours)
  const currentIron = Math.floor(resources.iron + resources.iron_rate * hours)
  const currentMana = Math.floor(resources.mana + resources.mana_rate * hours)

  if (cost.wood && currentWood < cost.wood) return res.status(409).json({ error: `Madera insuficiente (necesitas ${cost.wood})` })
  if (cost.iron && currentIron < cost.iron) return res.status(409).json({ error: `Hierro insuficiente (necesitas ${cost.iron})` })
  if (cost.mana && currentMana < cost.mana) return res.status(409).json({ error: `Maná insuficiente (necesitas ${cost.mana})` })

  const nowIso = new Date(now).toISOString()
  const endsAt = new Date(now + durationMs).toISOString()

  // Descontar recursos (snapshot en este momento)
  const { error: resourcesError } = await supabase
    .from('resources')
    .update({
      wood: currentWood - (cost.wood ?? 0),
      iron: currentIron - (cost.iron ?? 0),
      mana: currentMana - (cost.mana ?? 0),
      last_collected_at: nowIso,
    })
    .eq('player_id', user.id)

  if (resourcesError) return res.status(500).json({ error: resourcesError.message })

  // Iniciar mejora
  const { error: buildingError } = await supabase
    .from('buildings')
    .update({ upgrade_started_at: nowIso, upgrade_ends_at: endsAt })
    .eq('id', buildingId)

  if (buildingError) return res.status(500).json({ error: buildingError.message })

  return res.status(200).json({ ok: true, endsAt })
}
