import { createClient } from '@supabase/supabase-js'

function upgradeCost(level) {
  return {
    gold: Math.round(100 * Math.pow(level, 1.6)),
    wood: Math.round(60 * Math.pow(level, 1.4)),
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

  const cost = upgradeCost(building.level)
  const durationMs = building.level * 2 * 60 * 1000

  const { data: resources } = await supabase
    .from('resources')
    .select('*')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  // Calcular recursos actuales con interpolación
  const now = Date.now()
  const minutesElapsed = (now - new Date(resources.last_collected_at).getTime()) / 60000
  const currentGold = Math.floor(resources.gold + resources.gold_rate * minutesElapsed)
  const currentWood = Math.floor(resources.wood + resources.wood_rate * minutesElapsed)

  if (currentGold < cost.gold) return res.status(409).json({ error: `Oro insuficiente (necesitas ${cost.gold})` })
  if (currentWood < cost.wood) return res.status(409).json({ error: `Madera insuficiente (necesitas ${cost.wood})` })

  const nowIso = new Date(now).toISOString()
  const endsAt = new Date(now + durationMs).toISOString()

  // Descontar recursos (snapshot en este momento)
  const { error: resourcesError } = await supabase
    .from('resources')
    .update({ gold: currentGold - cost.gold, wood: currentWood - cost.wood, last_collected_at: nowIso })
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
