import { createClient } from '@supabase/supabase-js'
import { interpolateHP } from './_hp.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { heroId } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })

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
