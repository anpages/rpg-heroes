import { requireAuth } from './_auth.js'

/**
 * POST /api/refining-collect
 * Recoge los items completados de un slot de refinado.
 * Body: { slotId: uuid }
 *
 * Usa RPC atómica: FOR UPDATE en slot + cálculo por tiempo + upsert inventario
 * + actualizar/borrar slot, todo en una transacción.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { slotId } = req.body
  if (!slotId) return res.status(400).json({ error: 'slotId requerido' })

  const { data: result, error: rpcErr } = await supabase.rpc('collect_refining_atomic', {
    p_player_id: user.id,
    p_slot_id: slotId,
  })

  if (rpcErr) {
    if (rpcErr.message.includes('no encontrado')) {
      return res.status(404).json({ error: rpcErr.message })
    }
    return res.status(500).json({ error: rpcErr.message })
  }

  return res.status(200).json(result)
}
