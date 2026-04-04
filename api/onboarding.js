import { createClient } from '@supabase/supabase-js'

const VALID_CLASSES = ['caudillo', 'arcanista', 'segador', 'sombra', 'domador']

const CLASS_STATS = {
  caudillo:  { strength: 16, agility: 10, intelligence: 5,  max_hp: 140, attack: 14, defense: 8 },
  arcanista: { strength: 5,  agility: 8,  intelligence: 18, max_hp: 70,  attack: 18, defense: 2 },
  segador:   { strength: 8,  agility: 7,  intelligence: 15, max_hp: 90,  attack: 12, defense: 4 },
  sombra:    { strength: 8,  agility: 18, intelligence: 8,  max_hp: 80,  attack: 13, defense: 3 },
  domador:   { strength: 10, agility: 10, intelligence: 12, max_hp: 110, attack: 11, defense: 6 },
}

const CLASS_ABILITY = {
  caudillo:  'torbellino',
  arcanista: 'bola_de_fuego',
  segador:   'invocar_muertos',
  sombra:    'golpe_sombrio',
  domador:   'invocar_bestia',
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

  const { heroName, heroClass } = req.body

  const name = heroName?.trim()
  if (!name || name.length < 2 || name.length > 20) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 20 caracteres' })
  }
  if (!VALID_CLASSES.includes(heroClass)) {
    return res.status(400).json({ error: 'Clase inválida' })
  }

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

  // Create resources
  const { error: resourcesError } = await supabase
    .from('resources')
    .insert({ player_id: user.id })

  if (resourcesError) return res.status(500).json({ error: resourcesError.message })

  // Create buildings (level 1)
  const { error: buildingsError } = await supabase
    .from('buildings')
    .insert(
      ['gold_mine', 'lumber_mill', 'mana_well', 'barracks', 'workshop'].map(type => ({
        player_id: user.id,
        type,
      }))
    )

  if (buildingsError) return res.status(500).json({ error: buildingsError.message })

  // Create hero
  const stats = CLASS_STATS[heroClass]
  const { data: hero, error: heroError } = await supabase
    .from('heroes')
    .insert({
      player_id: user.id,
      name,
      class: heroClass,
      ...stats,
      current_hp: stats.max_hp,
    })
    .select('id')
    .single()

  if (heroError) return res.status(500).json({ error: heroError.message })

  // Create initial ability
  await supabase.from('hero_abilities').insert({
    hero_id: hero.id,
    type: CLASS_ABILITY[heroClass],
  })

  return res.status(200).json({ ok: true })
}
