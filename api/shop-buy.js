import { requireAuth } from './_auth.js'
import { INVENTORY_BASE_LIMIT, SHOP_MAX_STOCK, getItemMinLevel } from './_constants.js'
import { isUUID, snapshotResources } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, catalogId } = req.body
  if (!heroId || !catalogId) return res.status(400).json({ error: 'heroId y catalogId requeridos' })
  if (!isUUID(heroId))    return res.status(400).json({ error: 'heroId inválido' })
  if (!isUUID(catalogId)) return res.status(400).json({ error: 'catalogId inválido' })

  const { data: hero } = await supabase
    .from('heroes').select('id, player_id, level').eq('id', heroId).eq('player_id', user.id).single()
  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  const { data: shopEntry } = await supabase
    .from('shop_catalog')
    .select('id, gold_price, item_catalog(id, tier, rarity, max_durability)')
    .eq('catalog_id', catalogId)
    .single()
  if (!shopEntry) return res.status(404).json({ error: 'Item no disponible en la tienda' })

  // Gate por nivel
  const minLevel = getItemMinLevel(shopEntry.item_catalog.tier, shopEntry.item_catalog.rarity)
  if (hero.level < minLevel) {
    return res.status(409).json({ error: `Necesitas nivel ${minLevel} para comprar este item` })
  }

  const dateStr = new Date().toISOString().slice(0, 10)

  // Verificar stock diario
  const { data: purchase } = await supabase
    .from('shop_purchases')
    .select('quantity')
    .eq('hero_id', heroId)
    .eq('catalog_id', catalogId)
    .eq('purchase_date', dateStr)
    .maybeSingle()

  if ((purchase?.quantity ?? 0) >= SHOP_MAX_STOCK) {
    return res.status(409).json({ error: 'Stock agotado para hoy' })
  }

  // Verificar oro — interpolar acumulado idle para no perder el gold generado
  const { data: resources } = await supabase
    .from('resources').select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at').eq('player_id', user.id).single()

  const snap = resources ? snapshotResources(resources) : { gold: 0, iron: 0, wood: 0, mana: 0, nowIso: new Date().toISOString() }

  if (snap.gold < shopEntry.gold_price) {
    return res.status(409).json({ error: 'Oro insuficiente' })
  }

  // Verificar inventario
  const { count: bagCount } = await supabase
    .from('inventory_items')
    .select('id', { count: 'exact', head: true })
    .eq('hero_id', heroId)
    .is('equipped_slot', null)

  if ((bagCount ?? 0) >= INVENTORY_BASE_LIMIT) {
    return res.status(409).json({ error: 'Inventario lleno' })
  }

  const { error: resErr, count: resCount } = await supabase
    .from('resources')
    .update({ gold: snap.gold - shopEntry.gold_price, iron: snap.iron, wood: snap.wood, mana: snap.mana, last_collected_at: snap.nowIso })
    .eq('player_id', user.id)
    .eq('last_collected_at', snap.prevCollectedAt)

  if (resErr) return res.status(500).json({ error: resErr.message })
  if (resCount === 0) return res.status(409).json({ error: 'Recursos actualizados por otra operación, reintenta' })

  // Crear item
  const { data: newItem } = await supabase
    .from('inventory_items')
    .insert({ hero_id: heroId, catalog_id: catalogId, current_durability: shopEntry.item_catalog.max_durability })
    .select('*, item_catalog(name, slot, tier, rarity)')
    .single()

  // Registrar compra
  if (purchase) {
    await supabase.from('shop_purchases')
      .update({ quantity: purchase.quantity + 1 })
      .eq('hero_id', heroId).eq('catalog_id', catalogId).eq('purchase_date', dateStr)
  } else {
    await supabase.from('shop_purchases')
      .insert({ hero_id: heroId, catalog_id: catalogId, purchase_date: dateStr, quantity: 1 })
  }

  return res.status(200).json({ ok: true, item: newItem, goldSpent: shopEntry.gold_price })
}
