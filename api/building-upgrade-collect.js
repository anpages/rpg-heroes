import { requireAuth } from './_auth.js'
import { UNLOCK_TRIGGERS } from './_constants.js'
import { isUUID, snapshotResources } from './_validate.js'
import { computeProductionRates } from '../src/lib/gameConstants.js'

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
  if (!building.upgrade_ends_at) return res.status(409).json({ error: 'No hay mejora en curso' })
  if (new Date(building.upgrade_ends_at) > new Date()) return res.status(409).json({ error: 'La mejora aún no ha terminado' })

  const newLevel = building.level + 1

  // Desbloquear edificios según árbol de progresión
  const triggers = UNLOCK_TRIGGERS.filter(t => t.type === building.type && t.level === newLevel)
  for (const trigger of triggers) {
    await supabase
      .from('buildings')
      .update({ unlocked: true })
      .eq('player_id', user.id)
      .in('type', trigger.unlocks)
  }

  // Subir nivel del edificio
  const { error: buildingError } = await supabase
    .from('buildings')
    .update({ level: newLevel, upgrade_started_at: null, upgrade_ends_at: null })
    .eq('id', buildingId)

  if (buildingError) return res.status(500).json({ error: buildingError.message })

  // Recalcular tasas con factor de energía (para todos los edificios relevantes)
  const { data: allBuildings } = await supabase
    .from('buildings')
    .select('type, level, unlocked')
    .eq('player_id', user.id)

  const rates = computeProductionRates(allBuildings ?? [])

  // Hacer snapshot de recursos acumulados antes de cambiar las tasas
  const { data: resources } = await supabase
    .from('resources')
    .select('iron, wood, mana, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (resources) {
    const snap = snapshotResources(resources)
    await supabase
      .from('resources')
      .update({ ...rates, iron: snap.iron, wood: snap.wood, mana: snap.mana, last_collected_at: snap.nowIso })
      .eq('player_id', user.id)
  } else {
    await supabase
      .from('resources')
      .update(rates)
      .eq('player_id', user.id)
  }

  return res.status(200).json({ ok: true, newLevel, type: building.type })
}
