import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

/**
 * POST /api/item-upgrade-tier
 * Mejora el tier de un item consumiendo una Piedra de Forja del inventario de crafteo.
 * Body: { heroId, inventoryItemId }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, inventoryItemId } = req.body
  if (!heroId)           return res.status(400).json({ error: 'heroId requerido' })
  if (!inventoryItemId)  return res.status(400).json({ error: 'inventoryItemId requerido' })
  if (!isUUID(heroId))          return res.status(400).json({ error: 'heroId inválido' })
  if (!isUUID(inventoryItemId)) return res.status(400).json({ error: 'inventoryItemId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, status')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  // Obtener item con catálogo
  const { data: item } = await supabase
    .from('inventory_items')
    .select('*, item_catalog(slot, tier, rarity, is_two_handed, max_durability, name, required_class)')
    .eq('id', inventoryItemId)
    .eq('hero_id', heroId)
    .maybeSingle()

  if (!item) return res.status(404).json({ error: 'Ítem no encontrado' })

  const cat = item.item_catalog

  if (cat.tier >= 3) return res.status(409).json({ error: 'El ítem ya es de tier máximo (T3)' })
  if (item.current_durability < cat.max_durability) {
    return res.status(409).json({ error: 'El ítem debe estar al 100% de durabilidad para mejorar su tier' })
  }

  // Determinar piedra de forja necesaria
  const stoneId = cat.tier === 1 ? 'forge_stone_t2' : 'forge_stone_t3'
  const stoneLabel = cat.tier === 1 ? 'Piedra de Forja T2' : 'Piedra de Forja T3'

  // Verificar piedra de forja
  const { data: stone } = await supabase
    .from('player_crafted_items')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('recipe_id', stoneId)
    .maybeSingle()

  if (!stone || stone.quantity <= 0) {
    return res.status(409).json({ error: `Necesitas una ${stoneLabel}. Craftéala en el Taller.` })
  }

  // Buscar el siguiente tier en el catálogo
  let catalogQuery = supabase
    .from('item_catalog')
    .select('id, max_durability, name')
    .eq('slot', cat.slot)
    .eq('rarity', cat.rarity)
    .eq('tier', cat.tier + 1)

  if (cat.is_two_handed === true) {
    catalogQuery = catalogQuery.eq('is_two_handed', true)
  } else {
    catalogQuery = catalogQuery.or('is_two_handed.is.null,is_two_handed.eq.false')
  }

  if (cat.required_class) {
    catalogQuery = catalogQuery.eq('required_class', cat.required_class)
  } else {
    catalogQuery = catalogQuery.is('required_class', null)
  }

  const { data: nextCatalog } = await catalogQuery.maybeSingle()

  if (!nextCatalog) {
    return res.status(404).json({ error: 'No existe una versión T' + (cat.tier + 1) + ' de este ítem en el catálogo' })
  }

  // Consumir piedra + actualizar item
  const [{ error: stoneError }, { error: itemError }] = await Promise.all([
    supabase
      .from('player_crafted_items')
      .update({ quantity: stone.quantity - 1 })
      .eq('player_id', user.id)
      .eq('recipe_id', stoneId),
    supabase
      .from('inventory_items')
      .update({
        catalog_id:         nextCatalog.id,
        current_durability: nextCatalog.max_durability,
      })
      .eq('id', inventoryItemId),
  ])

  if (stoneError) return res.status(500).json({ error: stoneError.message })
  if (itemError) return res.status(500).json({ error: itemError.message })

  return res.status(200).json({ ok: true, newTier: cat.tier + 1, newItemName: nextCatalog.name })
}
