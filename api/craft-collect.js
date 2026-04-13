import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

/**
 * POST /api/craft-collect
 * Recoge un item cuyo crafteo ha terminado.
 * Body: { craftId: uuid }
 *
 * Usa RPC atómica: FOR UPDATE en craft + upsert inventario + borrar de cola
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { craftId } = req.body
  if (!craftId || !isUUID(craftId)) return res.status(400).json({ error: 'craftId inválido' })

  const { data: result, error: rpcErr } = await supabase.rpc('collect_craft_queue_atomic', {
    p_player_id: user.id,
    p_craft_id: craftId,
  })

  if (rpcErr) {
    if (rpcErr.message.includes('no encontrado')) return res.status(404).json({ error: rpcErr.message })
    if (rpcErr.message.includes('No autorizado')) return res.status(403).json({ error: rpcErr.message })
    if (rpcErr.message.includes('no ha terminado')) return res.status(409).json({ error: rpcErr.message })
    return res.status(500).json({ error: rpcErr.message })
  }

  return res.status(200).json(result)
}
