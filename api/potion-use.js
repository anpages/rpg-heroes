import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { interpolateHP } from './_hp.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, potionId } = req.body
  if (!heroId)   return res.status(400).json({ error: 'heroId requerido' })
  if (!potionId) return res.status(400).json({ error: 'potionId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar héroe (columnas correctas: current_hp, hp_last_updated_at)
  const { data: hero, error: heroError } = await supabase
    .from('heroes')
    .select('id, player_id, max_hp, current_hp, hp_last_updated_at, status, active_effects')
    .eq('id', heroId)
    .single()

  if (heroError || !hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // Verificar inventario
  const { data: stock } = await supabase
    .from('hero_potions')
    .select('quantity')
    .eq('hero_id', heroId)
    .eq('potion_id', potionId)
    .single()

  if (!stock || stock.quantity <= 0) return res.status(409).json({ error: 'No tienes esa poción' })

  // Obtener definición de la poción
  const { data: potion } = await supabase
    .from('potion_catalog')
    .select('effect_type, effect_value')
    .eq('id', potionId)
    .single()

  if (!potion) return res.status(404).json({ error: 'Poción no encontrada' })

  // Descontar del inventario
  await supabase
    .from('hero_potions')
    .update({ quantity: stock.quantity - 1 })
    .eq('hero_id', heroId)
    .eq('potion_id', potionId)

  let heroUpdate = {}
  let result = {}

  if (potion.effect_type === 'hp_restore') {
    const hpNow   = interpolateHP(hero, Date.now())
    const maxHp   = hero.max_hp ?? 100
    const restored = Math.round(maxHp * potion.effect_value)
    const newHp    = Math.min(maxHp, hpNow + restored)
    heroUpdate = {
      current_hp:         newHp,
      hp_last_updated_at: new Date().toISOString(),
    }
    result = { restored, newHp }
  } else {
    // Boost temporal — se almacena en active_effects
    const effects = hero.active_effects ?? {}
    effects[potion.effect_type] = potion.effect_value
    heroUpdate = { active_effects: effects }
    result = { effect: potion.effect_type, value: potion.effect_value }
  }

  const { error: updateError } = await supabase
    .from('heroes')
    .update(heroUpdate)
    .eq('id', heroId)

  if (updateError) return res.status(500).json({ error: updateError.message })

  return res.status(200).json({ ok: true, ...result })
}
