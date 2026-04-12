import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { DISMANTLE_GOLD_TABLE as DISMANTLE_GOLD } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { itemId } = req.body
  if (!itemId) return res.status(400).json({ error: 'itemId requerido' })
  if (!isUUID(itemId)) return res.status(400).json({ error: 'itemId inválido' })

  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, hero_id, equipped_slot, item_catalog(rarity, tier)')
    .eq('id', itemId)
    .single()

  if (!item) return res.status(404).json({ error: 'Item no encontrado' })
  if (item.equipped_slot) return res.status(409).json({ error: 'No puedes desmantelar un item equipado' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('player_id')
    .eq('id', item.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // Calcular oro obtenido
  const baseRate  = DISMANTLE_GOLD[item.item_catalog.rarity] ?? DISMANTLE_GOLD.common
  const goldGained = baseRate * (item.item_catalog.tier ?? 1)

  // Desmantelar item y añadir oro en paralelo
  const [deleteResult, addResult] = await Promise.all([
    supabase.from('inventory_items').delete().eq('id', itemId),
    supabase.rpc('add_resources', { p_player_id: user.id, p_gold: goldGained }),
  ])

  if (deleteResult.error) return res.status(500).json({ error: deleteResult.error.message })
  if (addResult.error) return res.status(500).json({ error: addResult.error.message })

  return res.status(200).json({ ok: true, gold: goldGained })
}
