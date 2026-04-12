import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { DISMANTLE_TRANSMUTE_TABLE } from './_constants.js'

/**
 * POST /api/item-transmute { itemId }
 *
 * Alternativa opcional al desmantelado por oro: el jugador paga al laboratorio
 * para extraer componentes de crafteo (fragmentos/esencia/maná) de un ítem.
 * El ítem se destruye igual que en el desmantelado clásico.
 *
 * El coste y la salida escalan con la rareza; no se multiplican por tier para
 * mantener la economía de drops intacta.
 */
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
  if (item.equipped_slot) return res.status(409).json({ error: 'No puedes transmutar un item equipado' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('player_id')
    .eq('id', item.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const rarity = item.item_catalog.rarity
  const entry = DISMANTLE_TRANSMUTE_TABLE[rarity] ?? DISMANTLE_TRANSMUTE_TABLE.common

  // Deducir oro (atómico via RPC)
  const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', { p_player_id: user.id, p_gold: entry.cost })
  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  if (!ok) return res.status(402).json({ error: 'Oro insuficiente para transmutar' })

  // Borrar item y añadir recursos ganados en paralelo
  const [deleteResult, addResult] = await Promise.all([
    supabase.from('inventory_items').delete().eq('id', itemId),
    supabase.rpc('add_resources', {
      p_player_id: user.id, p_mana: entry.mana, p_fragments: entry.fragments, p_essence: entry.essence,
    }),
  ])

  if (deleteResult.error) return res.status(500).json({ error: deleteResult.error.message })
  if (addResult.error) return res.status(500).json({ error: addResult.error.message })

  return res.status(200).json({
    ok: true,
    cost: entry.cost,
    gained: { fragments: entry.fragments, essence: entry.essence, mana: entry.mana },
  })
}
