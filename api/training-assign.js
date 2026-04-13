import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { TRAINING_ROOM_STATS } from './_constants.js'

/**
 * POST /api/training-assign
 * Asigna tokens de entrenamiento a un héroe.
 * Body: { heroId, stat, amount }
 *
 * Usa RPC atómica: FOR UPDATE en tokens + deducción + suma de stat
 * en una sola transacción. Sin read-then-write.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, stat, amount } = req.body
  if (!heroId || !isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })
  if (!stat || !TRAINING_ROOM_STATS.includes(stat)) return res.status(400).json({ error: 'stat inválido' })
  const qty = parseInt(amount, 10)
  if (!qty || qty <= 0) return res.status(400).json({ error: 'amount debe ser > 0' })

  // Verificar propiedad del héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  const { data: result, error: rpcErr } = await supabase.rpc('assign_training_atomic', {
    p_player_id: user.id,
    p_hero_id: heroId,
    p_stat: stat,
    p_amount: qty,
  })

  if (rpcErr) {
    if (rpcErr.message.includes('Tokens insuficientes')) {
      return res.status(409).json({ error: rpcErr.message })
    }
    return res.status(500).json({ error: rpcErr.message })
  }

  return res.status(200).json({
    ok: true,
    newStatValue: result.new_stat_value,
    tokensRemaining: result.tokens_remaining,
  })
}
