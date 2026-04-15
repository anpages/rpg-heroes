import { requireAuth } from './_auth.js'
import { STARTING_RESOURCES, ALL_BUILDING_TYPES, INITIALLY_UNLOCKED_BUILDINGS, STARTS_AT_LEVEL_ZERO, HERO_SLOT_CLASS } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroName } = req.body

  const name = heroName?.trim()
  if (!name || name.length < 2 || name.length > 20) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 20 caracteres' })
  }

  // El primer héroe siempre es Caudillo (slot 1)
  const heroClass = HERO_SLOT_CLASS[1]

  const { data: classData } = await supabase
    .from('classes')
    .select('*')
    .eq('id', heroClass)
    .single()

  if (!classData) return res.status(500).json({ error: 'Clase inicial no encontrada' })

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
    .insert({ player_id: user.id, ...STARTING_RESOURCES })

  if (resourcesError) return res.status(500).json({ error: resourcesError.message })

  // Create buildings
  const { error: buildingsError } = await supabase
    .from('buildings')
    .insert(
      ALL_BUILDING_TYPES.map(type => ({
        player_id: user.id,
        type,
        level:    (INITIALLY_UNLOCKED_BUILDINGS.includes(type) && !STARTS_AT_LEVEL_ZERO.has(type)) ? 1 : 0,
        unlocked: INITIALLY_UNLOCKED_BUILDINGS.includes(type),
      }))
    )

  if (buildingsError) return res.status(500).json({ error: buildingsError.message })

  // Create hero (slot 1, clase fija: Caudillo)
  const { data: hero, error: heroError } = await supabase
    .from('heroes')
    .insert({
      player_id:    user.id,
      name,
      class:        heroClass,
      slot:         1,
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

  await supabase.from('hero_abilities').insert({
    hero_id: hero.id,
    type: classData.starting_ability,
  })

  return res.status(200).json({ ok: true })
}
