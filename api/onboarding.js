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

  const { heroName, heroClass } = req.body

  const name = heroName?.trim()
  if (!name || name.length < 2 || name.length > 20) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 20 caracteres' })
  }

  // Obtener datos de la clase desde la BD
  const { data: classData } = await supabase
    .from('classes')
    .select('*')
    .eq('id', heroClass)
    .single()

  if (!classData) return res.status(400).json({ error: 'Clase inválida' })

  // Check player doesn't already exist
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) return res.status(409).json({ error: 'El jugador ya existe' })

  // Create player
  const { error: playerError } = await supabase
    .from('players')
    .insert({ id: user.id, username: name })

  if (playerError) {
    if (playerError.code === '23505') return res.status(409).json({ error: 'Nombre de usuario ocupado' })
    return res.status(500).json({ error: playerError.message })
  }

  // Create resources — valores explícitos (no depender de defaults de la BD)
  // wood_rate y mana_rate = 0 porque Aserradero y Pozo de Maná empiezan bloqueados
  const { error: resourcesError } = await supabase
    .from('resources')
    .insert({
      player_id: user.id,
      gold:      200,
      wood:      120,
      mana:      0,
      gold_rate: 2,
      wood_rate: 0,
      mana_rate: 0,
    })

  if (resourcesError) return res.status(500).json({ error: resourcesError.message })

  // Create buildings — barracks, gold_mine y energy_nexus desbloqueados desde el inicio
  const INITIALLY_UNLOCKED = ['barracks', 'gold_mine', 'energy_nexus']
  const ALL_BUILDING_TYPES = ['energy_nexus', 'gold_mine', 'lumber_mill', 'mana_well', 'barracks', 'workshop', 'forge', 'library']
  const { error: buildingsError } = await supabase
    .from('buildings')
    .insert(
      ALL_BUILDING_TYPES.map(type => ({
        player_id: user.id,
        type,
        unlocked: INITIALLY_UNLOCKED.includes(type),
      }))
    )

  if (buildingsError) return res.status(500).json({ error: buildingsError.message })

  // Create hero
  const { data: hero, error: heroError } = await supabase
    .from('heroes')
    .insert({
      player_id: user.id,
      name,
      class: heroClass,
      strength:     classData.strength,
      agility:      classData.agility,
      intelligence: classData.intelligence,
      max_hp:       classData.max_hp,
      current_hp:   classData.max_hp,
      attack:       classData.attack,
      defense:      classData.defense,
    })
    .select('id')
    .single()

  if (heroError) return res.status(500).json({ error: heroError.message })

  // Create initial ability
  await supabase.from('hero_abilities').insert({
    hero_id: hero.id,
    type: classData.starting_ability,
  })

  return res.status(200).json({ ok: true })
}
