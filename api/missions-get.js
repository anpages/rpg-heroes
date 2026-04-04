import { createClient } from '@supabase/supabase-js'
import { generateMissions } from './_missions.js'

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

  const today = new Date().toISOString().slice(0, 10)

  // Buscar misiones de hoy
  let { data: missions } = await supabase
    .from('daily_missions')
    .select('*')
    .eq('player_id', user.id)
    .eq('date', today)
    .order('created_at')

  // Generar si no existen todavía
  if (!missions?.length) {
    const toInsert = generateMissions(user.id, today)
    const { data: inserted } = await supabase
      .from('daily_missions')
      .insert(toInsert)
      .select('*')
    missions = inserted ?? []
  }

  // Calcular segundos hasta el siguiente reset (medianoche UTC)
  const now = new Date()
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const secondsToReset = Math.floor((tomorrow - now) / 1000)

  return res.status(200).json({ missions, secondsToReset })
}
