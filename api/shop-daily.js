import { createClient } from '@supabase/supabase-js'
import { SHOP_SIZE, SHOP_MAX_STOCK, MERCHANT_TYPES, getItemMinLevel } from './_constants.js'
import { isUUID } from './_validate.js'

function seededRand(heroId, dateStr) {
  let seed = 0
  for (const ch of `${heroId}-${dateStr}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  return function () {
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5
    return (seed >>> 0) / 0xffffffff
  }
}

function pickWeighted(items, rand, n) {
  const pool = [...items]
  const picked = []
  while (picked.length < n && pool.length > 0) {
    const total = pool.reduce((s, i) => s + i.daily_weight, 0)
    let r = rand() * total
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].daily_weight
      if (r <= 0) { picked.push(pool.splice(i, 1)[0]); break }
    }
  }
  return picked
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const heroId = req.query.heroId
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  // Hero + catalog en paralelo
  const [{ data: hero }, { data: catalog }] = await Promise.all([
    supabase.from('heroes').select('id, level').eq('id', heroId).eq('player_id', user.id).single(),
    supabase.from('shop_catalog').select('id, catalog_id, gold_price, daily_weight, item_catalog(name, slot, tier, rarity, attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus)'),
  ])

  if (!hero) return res.status(403).json({ error: 'No autorizado' })
  if (!catalog?.length) return res.status(200).json({ items: [], date: '', merchant: MERCHANT_TYPES[0] })

  const dateStr = new Date().toISOString().slice(0, 10)
  const rand = seededRand(heroId, dateStr)

  // Tipo de mercader del día para este héroe
  const merchantType = MERCHANT_TYPES[Math.floor(rand() * MERCHANT_TYPES.length)]

  // Filtrar por slots del mercader
  const filtered = catalog.filter(entry => merchantType.slots.includes(entry.item_catalog.slot))
  const rotation = pickWeighted(filtered, rand, Math.min(SHOP_SIZE, filtered.length))

  // Compras de hoy (solo para la rotación seleccionada)
  const rotationCatalogIds = rotation.map(e => e.catalog_id)
  const { data: purchases } = await supabase
    .from('shop_purchases')
    .select('catalog_id, quantity')
    .eq('hero_id', heroId)
    .eq('purchase_date', dateStr)
    .in('catalog_id', rotationCatalogIds)

  const purchaseMap = {}
  for (const p of purchases ?? []) purchaseMap[p.catalog_id] = p.quantity

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

  return res.status(200).json({ items, date: dateStr, merchant: merchantType })
}
