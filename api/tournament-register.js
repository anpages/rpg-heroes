import { createClient } from '@supabase/supabase-js'
import { getEffectiveStats } from './_stats.js'
import { getWeekStart, generateRivals, isRegistrationOpen } from './_tournament.js'
import { isUUID } from './_validate.js'

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
  if (!heroId)        return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, level, status')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  if (!isRegistrationOpen()) {
    return res.status(409).json({ error: 'Las inscripciones están cerradas. Vuelve el domingo o el lunes.' })
  }

  const weekStart = getWeekStart()

  // Comprobar inscripción previa
  const { data: existing } = await supabase
    .from('tournament_brackets')
    .select('id')
    .eq('hero_id', heroId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (existing) return res.status(409).json({ error: 'Ya estás inscrito en el torneo de esta semana' })

  const heroStats = await getEffectiveStats(supabase, heroId)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats del héroe' })

  const rivals = generateRivals(heroId, weekStart, heroStats)

  const { data: bracket, error } = await supabase
    .from('tournament_brackets')
    .insert({ hero_id: heroId, week_start: weekStart, rivals })
    .select('id, rivals, current_round, eliminated, champion')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true, bracket })
}
