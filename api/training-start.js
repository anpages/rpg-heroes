import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { error, count } = await supabase
    .from('heroes')
    .update({ status: 'training', training_started_at: new Date().toISOString() })
    .eq('id', heroId)
    .eq('player_id', user.id)
    .eq('status', 'idle')

  if (error)   return res.status(500).json({ error: error.message })
  if (count === 0) return res.status(409).json({ error: 'El héroe no está disponible' })

  return res.status(200).json({ ok: true })
}
