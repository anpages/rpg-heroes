import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

/**
 * POST /api/item-repair
 * Repara un item equipado consumiendo un repair_kit del inventario de crafteo.
 * Body: { itemId: uuid }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { itemId } = req.body
  if (!itemId) return res.status(400).json({ error: 'itemId requerido' })
  if (!isUUID(itemId)) return res.status(400).json({ error: 'itemId inválido' })

  // Obtener item con catálogo
  const { data: item } = await supabase
    .from('inventory_items')
    .select('*, item_catalog(name, rarity, slot, max_durability)')
    .eq('id', itemId)
    .single()

  if (!item) return res.status(404).json({ error: 'Item no encontrado' })

  // Verificar propiedad
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, status')
    .eq('id', item.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const catalog = item.item_catalog
  const missing = catalog.max_durability - item.current_durability
  if (missing === 0) return res.status(409).json({ error: 'El item ya está en perfecto estado' })

  // Verificar kit de reparación
  const { data: kit } = await supabase
    .from('player_crafted_items')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('recipe_id', 'repair_kit')
    .maybeSingle()

  if (!kit || kit.quantity <= 0) {
    return res.status(409).json({ error: 'Necesitas un Kit de Reparación. Craftéalo en el Taller.' })
  }

  // Consumir 1 kit
  const { error: kitError } = await supabase
    .from('player_crafted_items')
    .update({ quantity: kit.quantity - 1 })
    .eq('player_id', user.id)
    .eq('recipe_id', 'repair_kit')

  if (kitError) return res.status(500).json({ error: kitError.message })

  // Reparar item
  const { error: repairError } = await supabase
    .from('inventory_items')
    .update({ current_durability: catalog.max_durability })
    .eq('id', itemId)

  if (repairError) return res.status(500).json({ error: repairError.message })

  return res.status(200).json({ ok: true })
}
