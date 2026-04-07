import { createClient } from '@supabase/supabase-js'
import { isUUID, safeHours } from './_validate.js'
import { ITEM_TIER_UPGRADE_COST } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { heroId, inventoryItemId } = req.body
  if (!heroId)           return res.status(400).json({ error: 'heroId requerido' })
  if (!inventoryItemId)  return res.status(400).json({ error: 'inventoryItemId requerido' })
  if (!isUUID(heroId))          return res.status(400).json({ error: 'heroId inválido' })
  if (!isUUID(inventoryItemId)) return res.status(400).json({ error: 'inventoryItemId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  // Obtener item con catálogo
  const { data: item } = await supabase
    .from('inventory_items')
    .select('*, item_catalog(slot, tier, rarity, is_two_handed, max_durability, name)')
    .eq('id', inventoryItemId)
    .eq('hero_id', heroId)
    .maybeSingle()

  if (!item) return res.status(404).json({ error: 'Ítem no encontrado' })

  const cat = item.item_catalog

  // Validaciones
  if (cat.tier >= 3) {
    return res.status(409).json({ error: 'El ítem ya es de tier máximo (T3)' })
  }
  if (item.current_durability < cat.max_durability) {
    return res.status(409).json({ error: 'El ítem debe estar al 100% de durabilidad para mejorar su tier' })
  }

  const cost = ITEM_TIER_UPGRADE_COST[cat.tier]
  if (!cost) return res.status(500).json({ error: 'Coste de mejora de tier no definido' })

  // Buscar el siguiente tier en el catálogo (mismo slot, rareza, is_two_handed y tier+1)
  const { data: nextCatalog } = await supabase
    .from('item_catalog')
    .select('id, max_durability, name')
    .eq('slot', cat.slot)
    .eq('rarity', cat.rarity)
    .eq('is_two_handed', cat.is_two_handed ?? false)
    .eq('tier', cat.tier + 1)
    .maybeSingle()

  if (!nextCatalog) {
    return res.status(404).json({ error: 'No hay versión de tier superior para este ítem' })
  }

  // Snapshot de recursos y verificar costes
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (resourcesError || !resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const nowMs    = Date.now()
  const hours    = safeHours(resources.last_collected_at, nowMs)
  const curGold  = Math.floor(resources.gold + resources.gold_rate * hours)
  const curIron  = Math.floor(resources.iron + resources.iron_rate * hours)
  const curWood  = Math.floor(resources.wood + resources.wood_rate * hours)
  const curMana  = Math.floor(resources.mana + resources.mana_rate * hours)

  if (curGold < cost.gold) return res.status(402).json({ error: `Oro insuficiente (necesitas ${cost.gold})` })
  if (curIron < cost.iron) return res.status(402).json({ error: `Hierro insuficiente (necesitas ${cost.iron})` })
  if (curMana < cost.mana) return res.status(402).json({ error: `Maná insuficiente (necesitas ${cost.mana})` })

  // Descontar recursos
  const { error: resourceUpdateError } = await supabase
    .from('resources')
    .update({
      gold: curGold - cost.gold,
      iron: curIron - cost.iron,
      wood: curWood,
      mana: curMana - cost.mana,
      last_collected_at: new Date(nowMs).toISOString(),
    })
    .eq('player_id', user.id)

  if (resourceUpdateError) return res.status(500).json({ error: resourceUpdateError.message })

  // Actualizar ítem: nuevo catalog_id y durabilidad máxima del nuevo tier
  const { error: itemUpdateError } = await supabase
    .from('inventory_items')
    .update({
      item_catalog_id:    nextCatalog.id,
      current_durability: nextCatalog.max_durability,
    })
    .eq('id', inventoryItemId)

  if (itemUpdateError) return res.status(500).json({ error: itemUpdateError.message })

  return res.status(200).json({ ok: true, newTier: cat.tier + 1, newItemName: nextCatalog.name })
}
