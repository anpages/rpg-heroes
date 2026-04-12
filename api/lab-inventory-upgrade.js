import { requireAuth } from './_auth.js'
import { LAB_INVENTORY_MAX_UPGRADES, LAB_INVENTORY_UPGRADE_COSTS } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { data: resources } = await supabase
    .from('resources')
    .select('lab_inventory_upgrades')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const current = resources.lab_inventory_upgrades ?? 0
  if (current >= LAB_INVENTORY_MAX_UPGRADES) {
    return res.status(409).json({ error: 'Inventario del laboratorio al máximo' })
  }

  const cost = LAB_INVENTORY_UPGRADE_COSTS[current]
  if (!cost) return res.status(500).json({ error: 'Coste no definido' })

  // Deducir recursos (atómico via RPC)
  const deductArgs = { p_player_id: user.id }
  if (cost.gold) deductArgs.p_gold = cost.gold
  if (cost.mana) deductArgs.p_mana = cost.mana
  const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', deductArgs)
  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  if (!ok) return res.status(402).json({ error: 'Recursos insuficientes' })

  // Incrementar contador
  const { error } = await supabase.from('resources')
    .update({ lab_inventory_upgrades: current + 1 })
    .eq('player_id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true, lab_inventory_upgrades: current + 1 })
}
