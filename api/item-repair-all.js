import { requireAuth } from './_auth.js'
import { snapshotResources } from './_validate.js'
import {
  REPAIR_COST_TABLE as REPAIR_COST,
  REPAIR_IRON_BY_RARITY,
  REPAIR_IRON_SLOT_MULT,
} from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, status, active_effects')
    .eq('id', heroId)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (hero.status === 'exploring') return res.status(409).json({ error: 'El héroe está en una expedición' })

  const freeRepair = !!hero.active_effects?.free_repair

  // Obtener items equipados con durabilidad < máxima
  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, current_durability, item_catalog(rarity, slot, max_durability)')
    .eq('hero_id', heroId)
    .not('equipped_slot', 'is', null)

  const damaged = (items ?? []).filter(i => i.current_durability < i.item_catalog.max_durability)
  if (damaged.length === 0) return res.status(409).json({ error: 'Todo el equipo está en perfecto estado' })

  // Investigación: descuento de reparación
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)
  const totalDiscount = Math.min(0.9, -rb.repair_cost_pct)

  let totalGold = 0
  let totalMana = 0
  let totalIron = 0
  if (!freeRepair) {
    for (const item of damaged) {
      const missing = item.item_catalog.max_durability - item.current_durability
      const costs = REPAIR_COST[item.item_catalog.rarity] ?? REPAIR_COST.common
      const ironPerPoint = REPAIR_IRON_BY_RARITY[item.item_catalog.rarity] ?? 0
      const slotMult     = REPAIR_IRON_SLOT_MULT[item.item_catalog.slot] ?? 1
      totalGold += Math.ceil(missing * costs.gold * (1 - totalDiscount))
      totalMana += Math.ceil(missing * costs.mana * (1 - totalDiscount))
      totalIron += Math.ceil(missing * ironPerPoint * slotMult * (1 - totalDiscount))
    }
  }

  // Verificar recursos
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(500).json({ error: 'No se pudieron obtener los recursos' })

  const snap = snapshotResources(resources)

  if (snap.gold < totalGold) return res.status(409).json({ error: `Oro insuficiente (necesitas ${totalGold})` })
  if (snap.mana < totalMana) return res.status(409).json({ error: `Maná insuficiente (necesitas ${totalMana})` })
  if (snap.iron < totalIron) return res.status(409).json({ error: `Hierro insuficiente (necesitas ${totalIron})` })

  // Reparar todos
  await Promise.all(damaged.map(item =>
    supabase
      .from('inventory_items')
      .update({ current_durability: item.item_catalog.max_durability })
      .eq('id', item.id)
  ))

  const { error: resErr, count: resCount } = await supabase
    .from('resources')
    .update({
      gold: snap.gold - totalGold,
      iron: snap.iron - totalIron,
      wood: snap.wood,
      mana: snap.mana - totalMana,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)
    .eq('last_collected_at', snap.prevCollectedAt)

  if (resErr) return res.status(500).json({ error: resErr.message })
  if (resCount === 0) return res.status(409).json({ error: 'Recursos desincronizados, reintenta' })

  if (freeRepair) {
    const newEffects = { ...(hero.active_effects ?? {}) }
    delete newEffects.free_repair
    await supabase.from('heroes').update({ active_effects: newEffects }).eq('id', heroId)
  }

  return res.status(200).json({ ok: true, totalGold, totalMana, totalIron, repaired: damaged.length, freeRepair })
}
