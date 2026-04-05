import { createClient } from '@supabase/supabase-js'

const SHOP_SIZE = 8
const MAX_STOCK = 1

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

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { data: hero } = await supabase
    .from('heroes').select('id').eq('id', heroId).eq('player_id', user.id).single()
  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  const { data: catalog } = await supabase
    .from('shop_catalog')
    .select('id, catalog_id, gold_price, daily_weight, item_catalog(name, slot, tier, rarity, attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus)')

  if (!catalog?.length) return res.status(200).json({ items: [], date: '', maxStock: MAX_STOCK })

  const dateStr = new Date().toISOString().slice(0, 10)
  const rand = seededRand(heroId, dateStr)
  const rotation = pickWeighted(catalog, rand, Math.min(SHOP_SIZE, catalog.length))

  const { data: purchases } = await supabase
    .from('shop_purchases')
    .select('catalog_id, quantity')
    .eq('hero_id', heroId)
    .eq('purchase_date', dateStr)

  const purchaseMap = {}
  for (const p of purchases ?? []) purchaseMap[p.catalog_id] = p.quantity

  const items = rotation.map(entry => ({
    shopId:    entry.id,
    catalogId: entry.catalog_id,
    goldPrice: entry.gold_price,
    maxStock:  MAX_STOCK,
    purchased: purchaseMap[entry.catalog_id] ?? 0,
    ...entry.item_catalog,
  }))

  return res.status(200).json({ items, date: dateStr, maxStock: MAX_STOCK })
}
