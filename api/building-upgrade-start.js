import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import {
  computeBaseLevel,
  buildingUpgradeCost,
  buildingUpgradeDurationMs,
  HERB_GARDEN_BASE_LEVEL_REQUIRED,
  DESTILERIA_BASE_LEVEL_REQUIRED,
  HERBOLARIO_BASE_LEVEL_REQUIRED,
  LAB_BASE_LEVEL_REQUIRED,
  BUILDING_MAX_LEVEL,
  REFINING_MAX_LEVEL,
  LAB_MAX_LEVEL,
  REFINING_BUILDING_TYPES,
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
  const maxLevel = REFINING_BUILDING_TYPES.includes(building.type) ? REFINING_MAX_LEVEL
    : building.type === 'laboratory' ? LAB_MAX_LEVEL
    : BUILDING_MAX_LEVEL
  if (building.level >= maxLevel) return res.status(409).json({ error: `Nivel máximo alcanzado (${maxLevel})` })
  if (building.upgrade_ends_at && new Date(building.upgrade_ends_at) > new Date()) {
    return res.status(409).json({ error: 'El edificio ya está mejorando' })
  }

  // Solo se puede mejorar un edificio a la vez dentro de la misma zona
  const ZONE_MAP = {
    gold_mine: 'recursos', lumber_mill: 'recursos', mana_well: 'recursos', herb_garden: 'recursos',
    carpinteria: 'refinado', fundicion: 'refinado', destileria_arcana: 'refinado', herbolario: 'refinado',
    laboratory: 'laboratorio', library: 'biblioteca',
  }
  const zone = ZONE_MAP[building.type]
  const sameZoneTypes = Object.entries(ZONE_MAP).filter(([, z]) => z === zone).map(([t]) => t)
  const queueNow = new Date().toISOString()
  const { data: busyBuildings } = await supabase
    .from('buildings').select('id').eq('player_id', user.id).in('type', sameZoneTypes).gt('upgrade_ends_at', queueNow).limit(1)
  if (busyBuildings?.length > 0) {
    return res.status(409).json({ error: 'Ya hay una construcción en curso en esta zona. Espera a que termine.' })
  }

  // Edificios con requisito de nivel de base
  // Biblioteca: no tiene requisito de base level, solo necesita el trigger de lab Nv1
  const BASE_LEVEL_CHECKS = {
    herb_garden:       { min: HERB_GARDEN_BASE_LEVEL_REQUIRED, label: 'el Jardín de Hierbas' },
    destileria_arcana: { min: DESTILERIA_BASE_LEVEL_REQUIRED,  label: 'la Destilería Arcana' },
    herbolario:        { min: HERBOLARIO_BASE_LEVEL_REQUIRED,  label: 'el Herbolario' },
    laboratory:        { min: LAB_BASE_LEVEL_REQUIRED,         label: 'el Laboratorio' },
  }
  const baseLevelCheck = BASE_LEVEL_CHECKS[building.type]
  if (baseLevelCheck) {
    const { data: allBuildings } = await supabase
      .from('buildings').select('type, level, unlocked').eq('player_id', user.id)
    const baseLevel = computeBaseLevel(allBuildings ?? [])
    if (baseLevel < baseLevelCheck.min) {
      return res.status(403).json({ error: `Necesitas base nivel ${baseLevelCheck.min} para construir ${baseLevelCheck.label}` })
    }
  }

  const cost       = buildingUpgradeCost(building.type, building.level)
  const durationMs = buildingUpgradeDurationMs(building.level, building.type)

  const endsAt = new Date(Date.now() + durationMs).toISOString()

  // Deducir recursos (atómico via RPC)
  const deductArgs = { p_player_id: user.id }
  if (cost.wood)  deductArgs.p_wood  = cost.wood
  if (cost.iron)  deductArgs.p_iron  = cost.iron
  if (cost.mana)  deductArgs.p_mana  = cost.mana
  if (cost.herbs) deductArgs.p_herbs = cost.herbs

  const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', deductArgs)
  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  if (!ok) return res.status(409).json({ error: 'Recursos insuficientes' })

  // Iniciar mejora
  const { error: buildingError } = await supabase
    .from('buildings')
    .update({ upgrade_started_at: new Date().toISOString(), upgrade_ends_at: endsAt })
    .eq('id', buildingId)

  if (buildingError) return res.status(500).json({ error: buildingError.message })

  return res.status(200).json({ ok: true, endsAt })
}
