import { createClient } from '@supabase/supabase-js'
import { UNLOCK_TRIGGERS } from './_constants.js'

function computeRates(buildings) {
  // Solo edificios desbloqueados contribuyen a producción y consumo energético
  const unlockedLevel = (type) => {
    const b = buildings.find(b => b.type === type)
    return (b && b.unlocked !== false) ? b.level : 0
  }

  const goldMine = unlockedLevel('gold_mine')
  const lumber   = unlockedLevel('lumber_mill')
  const mana     = unlockedLevel('mana_well')
  const nexus    = unlockedLevel('energy_nexus')

  const energyProduced = nexus * 30
  const energyConsumed = (goldMine + lumber + mana) * 10
  const ratio = energyConsumed > 0 ? Math.min(1, energyProduced / energyConsumed) : 1

  return {
    gold_rate: goldMine > 0 ? Math.max(1, Math.floor((2 + (goldMine - 1)) * ratio)) : 0,
    wood_rate: lumber   > 0 ? Math.max(1, Math.floor((1 + (lumber   - 1)) * ratio)) : 0,
    mana_rate: mana     > 0 ? Math.max(1, Math.floor((1 + (mana     - 1)) * ratio)) : 0,
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

  // Desbloquear edificios según árbol de progresión
  const triggers = UNLOCK_TRIGGERS.filter(t => t.type === building.type && t.level === newLevel)
  for (const trigger of triggers) {
    await supabase
      .from('buildings')
      .update({ unlocked: true })
      .eq('player_id', user.id)
      .in('type', trigger.unlocks)
  }

  // Aplicar efecto especial: cuartel → +2 atributos a CADA héroe del jugador
  if (building.type === 'barracks') {
    const { data: allHeroes } = await supabase
      .from('heroes')
      .select('id, strength, agility, intelligence')
      .eq('player_id', user.id)
    for (const h of allHeroes ?? []) {
      await supabase
        .from('heroes')
        .update({
          strength:     h.strength     + 2,
          agility:      h.agility      + 2,
          intelligence: h.intelligence + 2,
        })
        .eq('id', h.id)
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
    .select('type, level, unlocked')
    .eq('player_id', user.id)

  const rates = computeRates(allBuildings ?? [])

  // Hacer snapshot de recursos acumulados antes de cambiar las tasas
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, wood, mana, gold_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  const now = Date.now()
  if (resources) {
    const minutesElapsed = (now - new Date(resources.last_collected_at).getTime()) / 60000
    const snapshotGold = Math.floor(resources.gold + resources.gold_rate * minutesElapsed)
    const snapshotWood = Math.floor(resources.wood + resources.wood_rate * minutesElapsed)
    const snapshotMana = Math.floor(resources.mana + resources.mana_rate * minutesElapsed)
    await supabase
      .from('resources')
      .update({ ...rates, gold: snapshotGold, wood: snapshotWood, mana: snapshotMana, last_collected_at: new Date(now).toISOString() })
      .eq('player_id', user.id)
  } else {
    await supabase
      .from('resources')
      .update(rates)
      .eq('player_id', user.id)
  }

  return res.status(200).json({ ok: true, newLevel, type: building.type })
}
