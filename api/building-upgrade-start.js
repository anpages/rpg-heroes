import { createClient } from '@supabase/supabase-js'
import { safeMinutes } from './_validate.js'

function upgradeCost(type, level) {
  switch (type) {
    case 'barracks':
      return { gold: Math.round(100 * Math.pow(level, 1.8)), wood: Math.round(55 * Math.pow(level, 1.5)) }
    case 'workshop':
      return { gold: Math.round(80  * Math.pow(level, 1.7)), wood: Math.round(50 * Math.pow(level, 1.5)) }
    case 'forge':
      return { gold: Math.round(70  * Math.pow(level, 1.6)), wood: Math.round(35 * Math.pow(level, 1.4)), mana: Math.round(25 * Math.pow(level, 1.3)) }
    case 'library':
      return { gold: Math.round(70  * Math.pow(level, 1.6)), mana: Math.round(45 * Math.pow(level, 1.5)) }
    default:
      return { gold: Math.round(60  * Math.pow(level, 1.6)), wood: Math.round(36 * Math.pow(level, 1.4)) }
  }
}

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

  const { data: building } = await supabase
    .from('buildings')
    .select('*')
    .eq('id', buildingId)
    .single()

  if (!building) return res.status(404).json({ error: 'Edificio no encontrado' })
  if (building.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
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

  const cost = upgradeCost(building.type, building.level)
  const durationMs = building.level * building.level * 10 * 60 * 1000

  const { data: resources } = await supabase
    .from('resources')
    .select('*')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  // Calcular recursos actuales con interpolación
  const now = Date.now()
  const mins = safeMinutes(resources.last_collected_at, now)
  const currentGold = Math.floor(resources.gold + resources.gold_rate * mins)
  const currentWood = Math.floor(resources.wood + resources.wood_rate * mins)
  const currentMana = Math.floor(resources.mana + resources.mana_rate * mins)

  if (currentGold < cost.gold) return res.status(409).json({ error: `Oro insuficiente (necesitas ${cost.gold})` })
  if (cost.wood && currentWood < cost.wood) return res.status(409).json({ error: `Madera insuficiente (necesitas ${cost.wood})` })
  if (cost.mana && currentMana < cost.mana) return res.status(409).json({ error: `Maná insuficiente (necesitas ${cost.mana})` })

  const nowIso = new Date(now).toISOString()
  const endsAt = new Date(now + durationMs).toISOString()

  // Descontar recursos (snapshot en este momento)
  const { error: resourcesError } = await supabase
    .from('resources')
    .update({
      gold: currentGold - cost.gold,
      wood: currentWood - (cost.wood ?? 0),
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
