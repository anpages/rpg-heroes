import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { getWeekStart, generateRivals, isRegistrationOpen } from './_tournament.js'
import { isUUID } from './_validate.js'
import { CLASS_ARCHETYPE_POOL } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

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

  const heroStats = await getEffectiveStats(supabase, heroId, user.id)
  if (!heroStats) return res.status(500).json({ error: 'No se pudieron obtener stats del héroe' })

  const { data: allHeroes } = await supabase.from('heroes').select('class').eq('player_id', user.id)
  const unlockedClasses = [...new Set((allHeroes ?? []).map(h => h.class).filter(Boolean))]
  const archetypePool = [...new Set(unlockedClasses.flatMap(c => CLASS_ARCHETYPE_POOL[c] ?? []))]

  const rivals = generateRivals(heroId, weekStart, heroStats, archetypePool.length > 0 ? archetypePool : undefined)

  const { data: bracket, error } = await supabase
    .from('tournament_brackets')
    .insert({ hero_id: heroId, week_start: weekStart, rivals })
    .select('id, rivals, current_round, eliminated, champion')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true, bracket })
}
