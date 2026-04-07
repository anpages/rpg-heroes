import { createClient } from '@supabase/supabase-js'
import { INVENTORY_BASE_LIMIT, INVENTORY_PER_WORKSHOP_LEVEL, SHOP_MAX_STOCK, getItemMinLevel } from './_constants.js'
import { isUUID, safeHours } from './_validate.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const { heroId, catalogId } = req.body
  if (!heroId || !catalogId) return res.status(400).json({ error: 'heroId y catalogId requeridos' })
  if (!isUUID(heroId))    return res.status(400).json({ error: 'heroId inválido' })
  if (!isUUID(catalogId)) return res.status(400).json({ error: 'catalogId inválido' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

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

  const now = Date.now()
  const hours = resources ? safeHours(resources.last_collected_at, now) : 0
  const currentGold = resources ? Math.floor(resources.gold + resources.gold_rate * hours) : 0

  if (currentGold < shopEntry.gold_price) {
    return res.status(409).json({ error: 'Oro insuficiente' })
  }

  // Verificar inventario
  const { count: bagCount } = await supabase
    .from('inventory_items')
    .select('id', { count: 'exact', head: true })
    .eq('hero_id', heroId)
    .is('equipped_slot', null)

  const { data: workshop } = await supabase
    .from('buildings').select('level').eq('player_id', user.id).eq('type', 'workshop').maybeSingle()

  const limit = INVENTORY_BASE_LIMIT + ((workshop?.level ?? 1) - 1) * INVENTORY_PER_WORKSHOP_LEVEL
  if ((bagCount ?? 0) >= limit) {
    return res.status(409).json({ error: 'Inventario lleno' })
  }

  // Descontar oro — snapshot de todos los recursos pasivos antes de mover last_collected_at
  const snapshotIron = resources ? Math.floor(resources.iron + resources.iron_rate * hours) : 0
  const snapshotWood = resources ? Math.floor(resources.wood + resources.wood_rate * hours) : 0
  const snapshotMana = resources ? Math.floor(resources.mana + resources.mana_rate * hours) : 0
  await supabase
    .from('resources')
    .update({ gold: currentGold - shopEntry.gold_price, iron: snapshotIron, wood: snapshotWood, mana: snapshotMana, last_collected_at: new Date(now).toISOString() })
    .eq('player_id', user.id)

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
