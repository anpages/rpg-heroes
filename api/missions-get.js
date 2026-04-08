import { requireAuth } from './_auth.js'
import { generateMissions } from './_missions.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res, 'GET')
  if (!auth) return
  const { user, supabase } = auth

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
