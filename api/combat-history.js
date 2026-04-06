import { createClient } from '@supabase/supabase-js'
import { isUUID } from './_validate.js'

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

  const { heroId } = req.query
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar que el héroe pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes')
    .select('id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  const { data: combats, error } = await supabase
    .from('tower_attempts')
    .select('id, floor, won, rounds, hero_hp_left, enemy_hp_left, log, hero_name, enemy_name, hero_max_hp, enemy_max_hp, created_at')
    .eq('hero_id', heroId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ combats: combats ?? [] })
}
