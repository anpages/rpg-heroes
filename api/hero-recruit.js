import { requireAuth } from './_auth.js'
import { computeBaseLevel } from '../src/lib/gameConstants.js'
import { HERO_SLOT_REQUIREMENTS, HERO_SLOT_CLASS } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroName } = req.body
  const name = heroName?.trim()
  if (!name || name.length < 2 || name.length > 20) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 20 caracteres' })
  }

  // Determinar el siguiente slot disponible
  const { data: existingHeroes } = await supabase
    .from('heroes')
    .select('slot')
    .eq('player_id', user.id)
    .order('slot')

  const usedSlots = (existingHeroes ?? []).map(h => h.slot)
  const nextSlot = [1, 2, 3, 4, 5].find(s => !usedSlots.includes(s))

  if (!nextSlot) return res.status(409).json({ error: 'Ya tienes todos los héroes desbloqueados' })

  // Validar requisito de nivel de Base
  const required = HERO_SLOT_REQUIREMENTS[nextSlot]
  if (required) {
    const { data: buildings } = await supabase
      .from('buildings')
      .select('type, level, unlocked')
      .eq('player_id', user.id)

    const baseLevel = computeBaseLevel(buildings ?? [])
    if (baseLevel < required) {
      return res.status(403).json({
        error: `Necesitas la Base en nivel ${required} para desbloquear este héroe`,
        code: 'BASE_LEVEL_REQUIRED',
        required,
        current: baseLevel,
      })
    }
  }

  // La clase está determinada por el slot — no se puede elegir
  const heroClass = HERO_SLOT_CLASS[nextSlot]

  const { data: classData } = await supabase
    .from('classes')
    .select('*')
    .eq('id', heroClass)
    .single()

  if (!classData) return res.status(500).json({ error: 'Clase de slot no encontrada' })

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

  return res.status(200).json({ ok: true, heroId: hero.id, slot: nextSlot, class: heroClass })
}
