import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { data, error } = await supabase
    .from('player_research')
    .select('node_id, status, ends_at, started_at')
    .eq('player_id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  const rows      = data ?? []
  const completed = rows.filter(r => r.status === 'completed').map(r => r.node_id)
  const active    = rows.find(r => r.status === 'active' && new Date(r.ends_at) > new Date()) ?? null

  return res.status(200).json({
    completed,
    active: active ? { node_id: active.node_id, ends_at: active.ends_at, started_at: active.started_at } : null,
  })
}
