import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res, 'GET')
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.query
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  const { data: towerData } = await supabase
    .from('tower_attempts')
    .select('id, floor, won, rounds, log, hero_name, enemy_name, hero_max_hp, enemy_max_hp, attempted_at')
    .eq('hero_id', heroId)
    .order('attempted_at', { ascending: false })
    .limit(30)

  const combats = (towerData ?? []).map(c => ({
    ...c,
    source:     'torre',
    created_at: c.attempted_at,
  }))

  return res.status(200).json({ combats })
}
