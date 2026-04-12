import { requireAuth } from './_auth.js'
import { SHOP_MAX_STOCK, getItemMinLevel } from './_constants.js'
import { isUUID, effectiveBagLimit } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, catalogId } = req.body
  if (!heroId || !catalogId) return res.status(400).json({ error: 'heroId y catalogId requeridos' })
  if (!isUUID(heroId))    return res.status(400).json({ error: 'heroId inválido' })
  if (!isUUID(catalogId)) return res.status(400).json({ error: 'catalogId inválido' })

  const { data: hero } = await supabase
    .from('heroes').select('id, player_id, level, class').eq('id', heroId).eq('player_id', user.id).single()
  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  const { data: shopEntry } = await supabase
    .from('shop_catalog')
    .select('id, gold_price, item_catalog(id, tier, rarity, max_durability, required_class)')
    .eq('catalog_id', catalogId)
    .single()
  if (!shopEntry) return res.status(404).json({ error: 'Item no disponible en la tienda' })

  // Gate por clase
  if (shopEntry.item_catalog.required_class && shopEntry.item_catalog.required_class !== hero.class) {
    return res.status(409).json({ error: 'Este item es exclusivo de otra clase' })
  }

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

  // Verificar inventario
  const [{ data: resources }, { count: bagCount }] = await Promise.all([
    supabase.from('resources').select('bag_extra_slots').eq('player_id', user.id).single(),
    supabase.from('inventory_items').select('id', { count: 'exact', head: true }).eq('hero_id', heroId).is('equipped_slot', null),
  ])

  if ((bagCount ?? 0) >= effectiveBagLimit(resources?.bag_extra_slots)) {
    return res.status(409).json({ error: 'Inventario lleno' })
  }

  // Deducir oro (atómico via RPC)
  const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', { p_player_id: user.id, p_gold: shopEntry.gold_price })
  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  if (!ok) return res.status(409).json({ error: 'Oro insuficiente' })

  // Comprobar si auto-equipar: slot libre → siempre; slot ocupado → solo si es mejor
  const STAT_KEYS = ['attack_bonus', 'defense_bonus', 'hp_bonus', 'strength_bonus', 'agility_bonus', 'intelligence_bonus']

  const { data: newCatalog } = await supabase
    .from('item_catalog').select('slot, ' + STAT_KEYS.join(', ')).eq('id', catalogId).single()
  const itemSlot = newCatalog?.slot ?? null

  let autoEquipSlot = null
  let unequipId = null
  if (itemSlot) {
    const { data: currentEquipped } = await supabase
      .from('inventory_items')
      .select('id, item_catalog(' + STAT_KEYS.join(', ') + ')')
      .eq('hero_id', heroId)
      .eq('equipped_slot', itemSlot)
      .maybeSingle()

    if (!currentEquipped) {
      // Slot libre → equipar directo
      autoEquipSlot = itemSlot
    } else {
      // Comparar suma de stats
      const newTotal = STAT_KEYS.reduce((sum, k) => sum + (newCatalog[k] ?? 0), 0)
      const oldTotal = STAT_KEYS.reduce((sum, k) => sum + (currentEquipped.item_catalog?.[k] ?? 0), 0)
      if (newTotal > oldTotal) {
        autoEquipSlot = itemSlot
        unequipId = currentEquipped.id
      }
    }
  }

  // Si hay que desequipar el item anterior → moverlo a mochila
  if (unequipId) {
    await supabase.from('inventory_items')
      .update({ equipped_slot: null })
      .eq('id', unequipId)
  }

  // Crear item (equipado si corresponde)
  const { data: newItem } = await supabase
    .from('inventory_items')
    .insert({
      hero_id: heroId,
      catalog_id: catalogId,
      current_durability: shopEntry.item_catalog.max_durability,
      ...(autoEquipSlot ? { equipped_slot: autoEquipSlot } : {}),
    })
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

  return res.status(200).json({ ok: true, item: newItem, goldSpent: shopEntry.gold_price, autoEquipped: !!autoEquipSlot })
}
