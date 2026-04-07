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
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, name')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  // Fetch Torre + brackets del héroe en paralelo
  const [towerRes, bracketRes] = await Promise.all([
    supabase
      .from('tower_attempts')
      .select('id, floor, won, rounds, log, hero_name, enemy_name, hero_max_hp, enemy_max_hp, attempted_at')
      .eq('hero_id', heroId)
      .order('attempted_at', { ascending: false })
      .limit(25),

    supabase
      .from('tournament_brackets')
      .select('id, rivals, week_start')
      .eq('hero_id', heroId),
  ])

  const towerCombats = (towerRes.data ?? []).map(c => ({
    ...c,
    source:     'torre',
    created_at: c.attempted_at,
  }))

  // Combates de torneo
  const bracketIds = (bracketRes.data ?? []).map(b => b.id)
  const bracketMap = Object.fromEntries((bracketRes.data ?? []).map(b => [b.id, b]))

  let tournamentCombats = []
  if (bracketIds.length) {
    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('id, bracket_id, round, won, log, hero_max_hp, rival_max_hp, played_at')
      .in('bracket_id', bracketIds)
      .order('played_at', { ascending: false })
      .limit(25)

    tournamentCombats = (matches ?? []).map(m => {
      const bracket = bracketMap[m.bracket_id]
      const rival   = bracket?.rivals?.[m.round - 1]
      return {
        id:           m.id,
        source:       'torneo',
        won:          m.won,
        round:        m.round,
        log:          m.log,
        hero_name:    hero.name,
        enemy_name:   rival?.name ?? `Rival R${m.round}`,
        hero_max_hp:  m.hero_max_hp,
        enemy_max_hp: m.rival_max_hp,
        created_at:   m.played_at,
      }
    })
  }

  const combats = [...towerCombats, ...tournamentCombats]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 40)

  return res.status(200).json({ combats })
}
