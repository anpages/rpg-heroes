import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { COMBAT_STRATEGIES } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, strategy } = req.body
  if (!heroId)            return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId))    return res.status(400).json({ error: 'heroId inválido' })
  if (!strategy || !(strategy in COMBAT_STRATEGIES))
    return res.status(400).json({ error: 'Estrategia inválida' })

  const { error } = await supabase
    .from('heroes')
    .update({ combat_strategy: strategy })
    .eq('id', heroId)
    .eq('player_id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true, strategy })
}
