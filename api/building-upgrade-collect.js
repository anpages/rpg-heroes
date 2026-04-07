import { createClient } from '@supabase/supabase-js'
import { UNLOCK_TRIGGERS } from './_constants.js'
import { isUUID, safeHours } from './_validate.js'
import { computeProductionRates } from '../src/lib/gameConstants.js'

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

  const now = Date.now()
  if (resources) {
    const hours = safeHours(resources.last_collected_at, now)
    const snapshotIron = Math.floor(resources.iron + resources.iron_rate * hours)
    const snapshotWood = Math.floor(resources.wood + resources.wood_rate * hours)
    const snapshotMana = Math.floor(resources.mana + resources.mana_rate * hours)
    await supabase
      .from('resources')
      .update({ ...rates, iron: snapshotIron, wood: snapshotWood, mana: snapshotMana, last_collected_at: new Date(now).toISOString() })
      .eq('player_id', user.id)
  } else {
    await supabase
      .from('resources')
      .update(rates)
      .eq('player_id', user.id)
  }

  return res.status(200).json({ ok: true, newLevel, type: building.type })
}
