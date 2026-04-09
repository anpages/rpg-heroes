import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { REPAIR_COST_TABLE as REPAIR_COST } from './_constants.js'

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
    .select('*, item_catalog(name, rarity, max_durability)')
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
  if (hero.status === 'exploring') return res.status(409).json({ error: 'El héroe está en una expedición' })

  const catalog = item.item_catalog
  const missing = catalog.max_durability - item.current_durability

  if (missing === 0) return res.status(409).json({ error: 'El item ya está en perfecto estado' })

  const costs = REPAIR_COST[catalog.rarity] ?? REPAIR_COST.common

  // Investigación: repair_cost_pct reduce el coste (valor negativo = descuento)
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)

  const totalDiscount = Math.min(0.9, -rb.repair_cost_pct)

  const goldCost = Math.ceil(missing * costs.gold * (1 - totalDiscount))
  const manaCost = Math.ceil(missing * costs.mana * (1 - totalDiscount))

  // Verificar recursos (con interpolación idle)
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(500).json({ error: 'No se pudieron obtener los recursos' })

  const snap = snapshotResources(resources)

  if (snap.gold < goldCost) return res.status(409).json({ error: `Oro insuficiente (necesitas ${goldCost})` })
  if (snap.mana < manaCost) return res.status(409).json({ error: `Maná insuficiente (necesitas ${manaCost})` })

  // Reparar
  await supabase
    .from('inventory_items')
    .update({ current_durability: catalog.max_durability })
    .eq('id', itemId)

  await supabase
    .from('resources')
    .update({
      gold: snap.gold - goldCost,
      iron: snap.iron,
      wood: snap.wood,
      mana: snap.mana - manaCost,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)

  return res.status(200).json({ ok: true, goldCost, manaCost })
}
