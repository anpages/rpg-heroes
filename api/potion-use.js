import { createClient } from '@supabase/supabase-js'
import { isUUID } from './_validate.js'
import { interpolateHp } from '../src/lib/hpInterpolation.js'

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

  const { heroId, potionId } = req.body
  if (!heroId)   return res.status(400).json({ error: 'heroId requerido' })
  if (!potionId) return res.status(400).json({ error: 'potionId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar héroe
  const { data: hero, error: heroError } = await supabase
    .from('heroes')
    .select('id, player_id, max_hp, hp_current, hp_updated_at, active_effects')
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
    // HP interpolado actual
    const hpNow   = interpolateHp(hero, Date.now())
    const maxHp   = hero.max_hp ?? 100
    const restored = Math.round(maxHp * potion.effect_value)
    const newHp    = Math.min(maxHp, hpNow + restored)
    heroUpdate = {
      hp_current:    newHp,
      hp_updated_at: new Date().toISOString(),
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
