import { requireAuth } from './_auth.js'

/**
 * POST /api/item-repair-all
 * Repara TODO el equipo de un héroe consumiendo un repair_kit_full.
 * Body: { heroId: uuid }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, status, active_effects')
    .eq('id', heroId)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (hero.status === 'exploring') return res.status(409).json({ error: 'El héroe está en una expedición' })

  // Obtener items equipados con durabilidad < máxima
  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, current_durability, item_catalog(rarity, slot, max_durability)')
    .eq('hero_id', heroId)
    .not('equipped_slot', 'is', null)

  const damaged = (items ?? []).filter(i => i.current_durability < i.item_catalog.max_durability)
  if (damaged.length === 0) return res.status(409).json({ error: 'Todo el equipo está en perfecto estado' })

  const freeRepair = !!hero.active_effects?.free_repair

  if (!freeRepair) {
    // Verificar kit de reparación completo
    const { data: kit } = await supabase
      .from('player_crafted_items')
      .select('quantity')
      .eq('player_id', user.id)
      .eq('recipe_id', 'repair_kit_full')
      .maybeSingle()

    if (!kit || kit.quantity <= 0) {
      return res.status(409).json({ error: 'Necesitas un Kit de Reparación Completo. Craftéalo en el Taller.' })
    }

    // Consumir 1 kit
    const { error: kitError } = await supabase
      .from('player_crafted_items')
      .update({ quantity: kit.quantity - 1 })
      .eq('player_id', user.id)
      .eq('recipe_id', 'repair_kit_full')

    if (kitError) return res.status(500).json({ error: kitError.message })
  }

  // Reparar todos
  await Promise.all(damaged.map(item =>
    supabase
      .from('inventory_items')
      .update({ current_durability: item.item_catalog.max_durability })
      .eq('id', item.id)
  ))

  if (freeRepair) {
    const newEffects = { ...(hero.active_effects ?? {}) }
    delete newEffects.free_repair
    await supabase.from('heroes').update({ active_effects: newEffects }).eq('id', heroId)
  }

  return res.status(200).json({ ok: true, repaired: damaged.length, freeRepair })
}
