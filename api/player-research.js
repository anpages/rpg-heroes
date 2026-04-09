import { requireAuth } from './_auth.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res, 'GET')
  if (!auth) return
  const { user, supabase } = auth

  const { data, error } = await supabase
    .from('player_research')
    .select('node_id, status, ends_at, started_at')
    .eq('player_id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  const rows      = data ?? []
  const completed = rows.filter(r => r.status === 'completed').map(r => r.node_id)
  const active    = rows.find(r => r.status === 'active') ?? null

  return res.status(200).json({
    completed,
    active: active ? { node_id: active.node_id, ends_at: active.ends_at, started_at: active.started_at } : null,
  })
}
