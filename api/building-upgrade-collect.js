import { createClient } from '@supabase/supabase-js'

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

  // Aplicar efecto según tipo
  if (building.type === 'gold_mine') {
    await supabase
      .from('resources')
      .update({ gold_rate: 10 + (newLevel - 1) * 5 })
      .eq('player_id', user.id)
  } else if (building.type === 'lumber_mill') {
    await supabase
      .from('resources')
      .update({ wood_rate: 6 + (newLevel - 1) * 3 })
      .eq('player_id', user.id)
  } else if (building.type === 'mana_well') {
    await supabase
      .from('resources')
      .update({ mana_rate: 2 + (newLevel - 1) })
      .eq('player_id', user.id)
  } else if (building.type === 'barracks') {
    const { data: hero } = await supabase
      .from('heroes')
      .select('attack, defense, max_hp, current_hp')
      .eq('player_id', user.id)
      .single()
    if (hero) {
      await supabase
        .from('heroes')
        .update({
          attack: hero.attack + 2,
          defense: hero.defense + 1,
          max_hp: hero.max_hp + 5,
          current_hp: hero.current_hp + 5,
        })
        .eq('player_id', user.id)
    }
  }
  // workshop: su efecto se aplica dinámicamente en expedition-start

  // Subir nivel del edificio y limpiar timer
  const { error: buildingError } = await supabase
    .from('buildings')
    .update({ level: newLevel, upgrade_started_at: null, upgrade_ends_at: null })
    .eq('id', buildingId)

  if (buildingError) return res.status(500).json({ error: buildingError.message })

  return res.status(200).json({ ok: true, newLevel, type: building.type })
}
