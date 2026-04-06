import { createClient } from '@supabase/supabase-js'
import { getWeekStart, isAutoEliminated } from './_tournament.js'
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
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  const weekStart = getWeekStart()

  const { data: bracket } = await supabase
    .from('tournament_brackets')
    .select('id, rivals, current_round, eliminated, champion, registered_at, week_start')
    .eq('hero_id', heroId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (!bracket) return res.status(200).json({ bracket: null, matches: [], weekStart })

  // Auto-eliminación lazy si se perdió la ventana de una ronda
  if (isAutoEliminated(bracket, weekStart)) {
    await supabase.from('tournament_brackets').update({ eliminated: true }).eq('id', bracket.id)
    bracket.eliminated = true
  }

  const { data: matches } = await supabase
    .from('tournament_matches')
    .select('id, round, won, log, rewards, hero_max_hp, rival_max_hp, played_at')
    .eq('bracket_id', bracket.id)
    .order('round')

  return res.status(200).json({ bracket, matches: matches ?? [], weekStart })
}
