import { requireAuth } from './_auth.js'
import { snapshotResources, effectiveBagLimit } from './_validate.js'
import { BAG_UPGRADE_COSTS, BAG_MAX_UPGRADES, BAG_SLOTS_PER_UPGRADE } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at, bag_extra_slots')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(500).json({ error: 'No se pudieron obtener los recursos' })

  const currentLevel = resources.bag_extra_slots ?? 0
  if (currentLevel >= BAG_MAX_UPGRADES) {
    return res.status(409).json({ error: 'Mochila al máximo' })
  }

  const cost = BAG_UPGRADE_COSTS[currentLevel]
  const snap = snapshotResources(resources)

  if (snap.gold < cost) {
    return res.status(409).json({ error: `Oro insuficiente (necesitas ${cost})` })
  }

  const { error: updateErr, count } = await supabase
    .from('resources')
    .update({
      gold: snap.gold - cost,
      iron: snap.iron,
      wood: snap.wood,
      mana: snap.mana,
      bag_extra_slots: currentLevel + 1,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)
    .eq('last_collected_at', snap.prevCollectedAt)

  if (updateErr) return res.status(500).json({ error: updateErr.message })
  if (count === 0) return res.status(409).json({ error: 'Recursos desincronizados, reintenta' })

  const newLimit = effectiveBagLimit(currentLevel + 1)

  return res.status(200).json({
    ok: true,
    bagExtraSlots: currentLevel + 1,
    bagLimit: newLimit,
    goldSpent: cost,
  })
}
