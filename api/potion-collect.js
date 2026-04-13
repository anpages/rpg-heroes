import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { MAX_POTION_STACK } from './_constants.js'

/**
 * POST /api/potion-collect
 * Recoge una poción crafteada.
 * Body: { craftId: uuid }
 *
 * Usa RPC atómica: FOR UPDATE en craft + stack check + upsert poción + borrar craft
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { craftId } = req.body
  if (!craftId) return res.status(400).json({ error: 'craftId requerido' })
  if (!isUUID(craftId)) return res.status(400).json({ error: 'craftId inválido' })

  const { data: result, error: rpcErr } = await supabase.rpc('collect_potion_atomic', {
    p_player_id: user.id,
    p_craft_id: craftId,
    p_max_stack: MAX_POTION_STACK,
  })

  if (rpcErr) {
    if (rpcErr.message.includes('no encontrado')) return res.status(404).json({ error: rpcErr.message })
    if (rpcErr.message.includes('no está lista')) return res.status(409).json({ error: rpcErr.message })
    if (rpcErr.message.includes('máximo')) return res.status(409).json({ error: rpcErr.message })
    return res.status(500).json({ error: rpcErr.message })
  }

  return res.status(200).json(result)
}
