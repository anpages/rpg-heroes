import { requireAuth } from './_auth.js'
import { SHOP_SIZE, SHOP_SPECIAL_COUNT, SHOP_MAX_STOCK, SHOP_REFRESH_COST, MERCHANT_TYPES, getItemMinLevel } from './_constants.js'
import { isUUID } from './_validate.js'

function seededRand(heroId, dateStr, refreshCount) {
  let seed = 0
  for (const ch of `${heroId}-${dateStr}-${refreshCount}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  return function () {
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5
    return (seed >>> 0) / 0xffffffff
  }
}

function pickWeighted(items, rand, n, weightKey = 'daily_weight') {
  const pool = [...items]
  const picked = []
  while (picked.length < n && pool.length > 0) {
    const total = pool.reduce((s, i) => s + (i[weightKey] ?? 1), 0)
    let r = rand() * total
    for (let i = 0; i < pool.length; i++) {
      r -= (pool[i][weightKey] ?? 1)
      if (r <= 0) { picked.push(pool.splice(i, 1)[0]); break }
    }
  }
  return picked
}

export default async function handler(req, res) {
  const auth = await requireAuth(req, res, 'GET')
  if (!auth) return
  const { user, supabase } = auth

  const heroId = req.query.heroId
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const dateStr = new Date().toISOString().slice(0, 10)

  // Hero + catalog + specials + refresh count del día en paralelo
  const [{ data: hero }, { data: catalog }, { data: specialCatalog }, { data: refreshRow }] = await Promise.all([
    supabase.from('heroes').select('id, level, class').eq('id', heroId).eq('player_id', user.id).single(),
    supabase.from('shop_catalog').select('id, catalog_id, gold_price, daily_weight, item_catalog(name, slot, tier, rarity, required_class, attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus)'),
    supabase.from('shop_special_catalog').select('id, name, description, gold_price, effect_type, effect_value, icon, weight'),
    supabase.from('hero_shop_refreshes').select('refresh_count').eq('hero_id', heroId).eq('refresh_date', dateStr).maybeSingle(),
  ])

  if (!hero) return res.status(403).json({ error: 'No autorizado' })
  if (!catalog?.length) return res.status(200).json({ items: [], specials: [], date: '', merchant: MERCHANT_TYPES[0], refreshCount: 0, refreshCost: SHOP_REFRESH_COST })

  const refreshCount = refreshRow?.refresh_count ?? 0
  const rand = seededRand(heroId, dateStr, refreshCount)

  // Tipo de mercader del día para este héroe
  const merchantType = MERCHANT_TYPES[Math.floor(rand() * MERCHANT_TYPES.length)]

  // Filtrar por slots del mercader + solo items universales o de la clase del héroe
  const filtered = catalog.filter(entry => {
    const ic = entry.item_catalog
    if (!merchantType.slots.includes(ic.slot)) return false
    if (ic.required_class && ic.required_class !== hero.class) return false
    return true
  })
  const rotation = pickWeighted(filtered, rand, Math.min(SHOP_SIZE, filtered.length))

  // Ofertas especiales del día (seeded, misma semilla)
  const specialRotation = pickWeighted(specialCatalog ?? [], rand, Math.min(SHOP_SPECIAL_COUNT, (specialCatalog ?? []).length), 'weight')

  // Compras de hoy (rotación regular + specials) en paralelo
  const rotationCatalogIds = rotation.map(e => e.catalog_id)
  const specialIds = specialRotation.map(s => s.id)
  const [{ data: purchases }, { data: specialPurchases }] = await Promise.all([
    supabase.from('shop_purchases')
      .select('catalog_id, quantity')
      .eq('hero_id', heroId)
      .eq('purchase_date', dateStr)
      .in('catalog_id', rotationCatalogIds),
    specialIds.length
      ? supabase.from('hero_shop_special_purchases')
          .select('special_id')
          .eq('hero_id', heroId)
          .eq('purchase_date', dateStr)
          .in('special_id', specialIds)
      : Promise.resolve({ data: [] }),
  ])

  const purchaseMap = {}
  for (const p of purchases ?? []) purchaseMap[p.catalog_id] = p.quantity
  const specialPurchaseSet = new Set((specialPurchases ?? []).map(p => p.special_id))

  const items = rotation.map(entry => {
    const ic = entry.item_catalog
    const minLevel = getItemMinLevel(ic.tier, ic.rarity)
    return {
      shopId:    entry.id,
      catalogId: entry.catalog_id,
      goldPrice: entry.gold_price,
      maxStock:  SHOP_MAX_STOCK,
      purchased: purchaseMap[entry.catalog_id] ?? 0,
      minLevel,
      locked:    hero.level < minLevel,
      ...ic,
    }
  })

  const specials = specialRotation.map(s => ({
    id:          s.id,
    name:        s.name,
    description: s.description,
    goldPrice:   s.gold_price,
    effectType:  s.effect_type,
    effectValue: s.effect_value,
    icon:        s.icon,
    purchased:   specialPurchaseSet.has(s.id),
  }))

  return res.status(200).json({
    items,
    specials,
    date: dateStr,
    merchant: merchantType,
    refreshCount,
    refreshCost: SHOP_REFRESH_COST,
  })
}
