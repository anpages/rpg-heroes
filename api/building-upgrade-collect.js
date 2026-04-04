import { createClient } from '@supabase/supabase-js'

function computeRates(buildings) {
  const level = (type) => buildings.find(b => b.type === type)?.level ?? 1

  const goldMine = level('gold_mine')
  const lumber   = level('lumber_mill')
  const mana     = level('mana_well')
  const nexus    = level('energy_nexus')

  const energyProduced = nexus * 30
  const energyConsumed = (goldMine + lumber + mana) * 10
  const ratio = energyConsumed > 0 ? Math.min(1, energyProduced / energyConsumed) : 1

  return {
    gold_rate: Math.floor((10 + (goldMine - 1) * 5) * ratio),
    wood_rate: Math.floor((6  + (lumber   - 1) * 3) * ratio),
    mana_rate: Math.floor((2  + (mana     - 1))     * ratio),
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
  if (!building.upgrade_ends_at) return res.status(409).json({ error: 'No hay mejora en curso' })
  if (new Date(building.upgrade_ends_at) > new Date()) return res.status(409).json({ error: 'La mejora aún no ha terminado' })

  const newLevel = building.level + 1

  // Aplicar efecto especial: cuartel → atributos base del héroe (presupuesto de cartas)
  if (building.type === 'barracks') {
    const { data: hero } = await supabase
      .from('heroes')
      .select('strength, agility, intelligence')
      .eq('player_id', user.id)
      .single()
    if (hero) {
      await supabase
        .from('heroes')
        .update({
          strength:     hero.strength     + 2,
          agility:      hero.agility      + 2,
          intelligence: hero.intelligence + 2,
        })
        .eq('player_id', user.id)
    }
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
    .select('type, level')
    .eq('player_id', user.id)

  const rates = computeRates(allBuildings ?? [])

  await supabase
    .from('resources')
    .update(rates)
    .eq('player_id', user.id)

  return res.status(200).json({ ok: true, newLevel, type: building.type })
}
