import { createClient } from '@supabase/supabase-js'

const SLOT_REQUIREMENTS = { 2: 5, 3: 10 } // slot → nivel mínimo de Cuartel

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

  // Obtener héroes actuales
  const { data: existingHeroes } = await supabase
    .from('heroes')
    .select('slot')
    .eq('player_id', user.id)
    .order('slot')

  const usedSlots = (existingHeroes ?? []).map(h => h.slot)
  const nextSlot = [1, 2, 3].find(s => !usedSlots.includes(s))

  if (!nextSlot) return res.status(409).json({ error: 'Ya tienes el máximo de héroes (3)' })

  // Validar requisito de Cuartel
  const required = SLOT_REQUIREMENTS[nextSlot]
  if (required) {
    const { data: barracks } = await supabase
      .from('buildings')
      .select('level')
      .eq('player_id', user.id)
      .eq('type', 'barracks')
      .maybeSingle()

    if (!barracks || barracks.level < required) {
      return res.status(403).json({
        error: `Necesitas el Cuartel en nivel ${required} para reclutar este héroe`,
      })
    }
  }

  // Obtener clase
  const { data: classData } = await supabase
    .from('classes')
    .select('*')
    .eq('id', heroClass)
    .single()

  if (!classData) return res.status(400).json({ error: 'Clase inválida' })

  // Crear héroe
  const { data: hero, error: heroError } = await supabase
    .from('heroes')
    .insert({
      player_id:    user.id,
      name,
      class:        heroClass,
      slot:         nextSlot,
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

  // Inicializar progreso en torre
  await supabase.from('tower_progress').insert({ hero_id: hero.id, max_floor: 0 })

  return res.status(200).json({ ok: true, heroId: hero.id, slot: nextSlot })
}
