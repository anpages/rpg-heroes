import { requireAuth } from './_auth.js'
import { effectiveBagLimit } from './_validate.js'
import { BAG_UPGRADE_COSTS, BAG_MAX_UPGRADES, BAG_SLOTS_PER_UPGRADE } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { data: resources } = await supabase
    .from('resources')
    .select('*')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(500).json({ error: 'No se pudieron obtener los recursos' })

  const currentLevel = resources.bag_extra_slots ?? 0
  if (currentLevel >= BAG_MAX_UPGRADES) {
    return res.status(409).json({ error: 'Mochila al máximo' })
  }

  const cost = BAG_UPGRADE_COSTS[currentLevel]

  // Deducir oro (atómico via RPC)
  const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', { p_player_id: user.id, p_gold: cost })
  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  if (!ok) return res.status(409).json({ error: `Oro insuficiente (necesitas ${cost})` })

  // Incrementar contador
  const { error: updateErr } = await supabase.from('resources')
    .update({ bag_extra_slots: currentLevel + 1 })
    .eq('player_id', user.id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  const newLimit = effectiveBagLimit(currentLevel + 1)

  return res.status(200).json({
    ok: true,
    bagExtraSlots: currentLevel + 1,
    bagLimit: newLimit,
    goldSpent: cost,
  })
}
