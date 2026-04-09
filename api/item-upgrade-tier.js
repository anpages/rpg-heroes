import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { ITEM_TIER_UPGRADE_COST } from '../src/lib/gameConstants.js'

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
  if (hero.status === 'exploring') return res.status(409).json({ error: 'El héroe está en una expedición' })

  // Obtener item con catálogo
  const { data: item } = await supabase
    .from('inventory_items')
    .select('*, item_catalog(slot, tier, rarity, is_two_handed, max_durability, name, required_class)')
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
  // is_two_handed puede ser true, false o null — tratamos null y false como "no es doble mano"
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

  // Snapshot de recursos y verificar costes
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, fragments, essence, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (resourcesError || !resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const snap        = snapshotResources(resources)
  const curFragments = resources.fragments ?? 0
  const curEssence   = resources.essence   ?? 0

  if (snap.gold    < cost.gold)      return res.status(402).json({ error: `Oro insuficiente (necesitas ${cost.gold})` })
  if (curFragments < cost.fragments) return res.status(402).json({ error: `Fragmentos insuficientes (necesitas ${cost.fragments})` })
  if (curEssence   < cost.essence)   return res.status(402).json({ error: `Esencia insuficiente (necesitas ${cost.essence})` })

  const { error: resourceUpdateError, count: resCount } = await supabase
    .from('resources')
    .update({
      gold:      snap.gold      - cost.gold,
      iron:      snap.iron,
      wood:      snap.wood,
      mana:      snap.mana,
      fragments: curFragments - cost.fragments,
      essence:   curEssence   - cost.essence,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)
    .eq('last_collected_at', snap.prevCollectedAt)

  if (resourceUpdateError) return res.status(500).json({ error: resourceUpdateError.message })
  if (resCount === 0) return res.status(409).json({ error: 'Recursos desincronizados, reintenta' })

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
