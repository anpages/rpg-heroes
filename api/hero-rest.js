import { requireAuth } from './_auth.js'
import { interpolateHP } from './_hp.js'
import { isUUID } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, status, current_hp, max_hp, hp_last_updated_at')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status === 'exploring') return res.status(409).json({ error: 'El héroe está en expedición' })

  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs)

  const entering = hero.status !== 'resting'
  const newStatus = entering ? 'resting' : 'idle'

  await supabase
    .from('heroes')
    .update({
      status: newStatus,
      current_hp: currentHp,
      hp_last_updated_at: new Date(nowMs).toISOString(),
    })
    .eq('id', heroId)

  return res.status(200).json({ ok: true, status: newStatus, current_hp: currentHp })
}
