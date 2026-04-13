import { requireAuth } from './_auth.js'

const RARITY_GOLD_PER_POINT = { common: 2, uncommon: 3, rare: 6, epic: 12, legendary: 22 }

/**
 * POST /api/item-repair-all
 * Repara TODO el equipo de un héroe consumiendo oro proporcional al daño total.
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
    .select('id, player_id')
    .eq('id', heroId)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, current_durability, item_catalog(rarity, max_durability)')
    .eq('hero_id', heroId)
    .not('equipped_slot', 'is', null)

  const damaged = (items ?? []).filter(i => i.current_durability < i.item_catalog.max_durability)
  if (damaged.length === 0) return res.status(409).json({ error: 'Todo el equipo está en perfecto estado' })

  const totalGold = damaged.reduce((sum, i) => {
    const missing = i.item_catalog.max_durability - i.current_durability
    const costPerPoint = RARITY_GOLD_PER_POINT[i.item_catalog.rarity] ?? 2
    return sum + missing * costPerPoint
  }, 0)

  const { data: ok, error: deductErr } = await supabase.rpc('deduct_resources', {
    p_player_id: user.id,
    p_gold: totalGold,
  })

  if (deductErr) return res.status(500).json({ error: deductErr.message })
  if (!ok) return res.status(409).json({ error: `Necesitas ${totalGold} oro para reparar todo el equipo` })

  await Promise.all(damaged.map(item =>
    supabase
      .from('inventory_items')
      .update({ current_durability: item.item_catalog.max_durability })
      .eq('id', item.id)
  ))

  return res.status(200).json({ ok: true, repaired: damaged.length, goldSpent: totalGold })
}
