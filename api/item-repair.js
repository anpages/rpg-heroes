import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

const RARITY_GOLD_PER_POINT = { common: 2, uncommon: 3, rare: 6, epic: 12, legendary: 22 }

/**
 * POST /api/item-repair
 * Repara un ítem equipado consumiendo oro proporcional al daño y rareza.
 * Body: { itemId: uuid }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { itemId } = req.body
  if (!itemId) return res.status(400).json({ error: 'itemId requerido' })
  if (!isUUID(itemId)) return res.status(400).json({ error: 'itemId inválido' })

  const { data: item } = await supabase
    .from('inventory_items')
    .select('*, item_catalog(name, rarity, max_durability)')
    .eq('id', itemId)
    .single()

  if (!item) return res.status(404).json({ error: 'Ítem no encontrado' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', item.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const catalog = item.item_catalog
  const missing = catalog.max_durability - item.current_durability
  if (missing === 0) return res.status(409).json({ error: 'El ítem ya está en perfecto estado' })

  const costPerPoint = RARITY_GOLD_PER_POINT[catalog.rarity] ?? 2
  const goldCost = missing * costPerPoint

  const { data: ok, error: deductErr } = await supabase.rpc('deduct_resources', {
    p_player_id: user.id,
    p_gold: goldCost,
  })

  if (deductErr) return res.status(500).json({ error: deductErr.message })
  if (!ok) return res.status(409).json({ error: `Necesitas ${goldCost} oro para reparar este ítem` })

  const { error: repairError } = await supabase
    .from('inventory_items')
    .update({ current_durability: catalog.max_durability })
    .eq('id', itemId)

  if (repairError) return res.status(500).json({ error: repairError.message })

  return res.status(200).json({ ok: true, goldSpent: goldCost })
}
