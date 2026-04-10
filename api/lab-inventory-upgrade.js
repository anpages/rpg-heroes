import { requireAuth } from './_auth.js'
import { snapshotResources } from './_validate.js'
import { LAB_INVENTORY_MAX_UPGRADES, LAB_INVENTORY_UPGRADE_COSTS } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, fragments, essence, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at, lab_inventory_upgrades')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const current = resources.lab_inventory_upgrades ?? 0
  if (current >= LAB_INVENTORY_MAX_UPGRADES) {
    return res.status(409).json({ error: 'Inventario del laboratorio al máximo' })
  }

  const cost = LAB_INVENTORY_UPGRADE_COSTS[current]
  if (!cost) return res.status(500).json({ error: 'Coste no definido' })

  const snap = snapshotResources(resources)

  if (snap.gold < (cost.gold ?? 0)) return res.status(402).json({ error: 'Oro insuficiente' })
  if (snap.mana < (cost.mana ?? 0)) return res.status(402).json({ error: 'Maná insuficiente' })

  const { error } = await supabase.from('resources').update({
    gold: snap.gold - (cost.gold ?? 0),
    iron: snap.iron,
    wood: snap.wood,
    mana: snap.mana - (cost.mana ?? 0),
    fragments: snap.fragments,
    essence: snap.essence,
    lab_inventory_upgrades: current + 1,
    last_collected_at: snap.nowIso,
  }).eq('player_id', user.id).eq('last_collected_at', snap.prevCollectedAt)

  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true, lab_inventory_upgrades: current + 1 })
}
