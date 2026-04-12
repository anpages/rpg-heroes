import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { TRAINING_ROOM_STATS } from './_constants.js'

/**
 * POST /api/training-assign
 * Asigna tokens de entrenamiento a un héroe.
 * Body: { heroId, stat, amount }
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

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, ' + stat)
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  // Verificar tokens disponibles
  const { data: token } = await supabase
    .from('player_training_tokens')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('stat', stat)
    .maybeSingle()

  if (!token || token.quantity < qty) {
    return res.status(409).json({ error: `Tokens insuficientes (tienes ${token?.quantity ?? 0})` })
  }

  // Deducir tokens y aplicar stats en paralelo
  const [{ error: tokenErr }, { error: heroErr }] = await Promise.all([
    supabase
      .from('player_training_tokens')
      .update({ quantity: token.quantity - qty })
      .eq('player_id', user.id)
      .eq('stat', stat),
    supabase
      .from('heroes')
      .update({ [stat]: (hero[stat] ?? 0) + qty })
      .eq('id', heroId),
  ])

  if (tokenErr) return res.status(500).json({ error: tokenErr.message })
  if (heroErr)  return res.status(500).json({ error: heroErr.message })

  return res.status(200).json({
    ok: true,
    newStatValue: (hero[stat] ?? 0) + qty,
    tokensRemaining: token.quantity - qty,
  })
}
