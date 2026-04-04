import { createClient } from '@supabase/supabase-js'

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

  const { missionId } = req.body
  if (!missionId) return res.status(400).json({ error: 'missionId requerido' })

  // Obtener misión
  const { data: mission } = await supabase
    .from('daily_missions')
    .select('*')
    .eq('id', missionId)
    .eq('player_id', user.id)
    .single()

  if (!mission) return res.status(404).json({ error: 'Misión no encontrada' })
  if (!mission.completed) return res.status(409).json({ error: 'Misión no completada' })
  if (mission.claimed) return res.status(409).json({ error: 'Recompensa ya reclamada' })

  // Obtener héroe para XP
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, experience, level')
    .eq('player_id', user.id)
    .single()

  // Obtener recursos
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, mana')
    .eq('player_id', user.id)
    .single()

  if (!hero || !resources) return res.status(500).json({ error: 'Error al obtener datos' })

  // Aplicar recompensas
  await Promise.all([
    supabase
      .from('resources')
      .update({
        gold: resources.gold + mission.reward_gold,
        mana: resources.mana + mission.reward_mana,
      })
      .eq('player_id', user.id),

    (() => {
      const newXp = hero.experience + mission.reward_xp
      const xpForLevel = hero.level * 150
      const levelUp = newXp >= xpForLevel
      return supabase
        .from('heroes')
        .update({
          experience: levelUp ? newXp - xpForLevel : newXp,
          level: levelUp ? hero.level + 1 : hero.level,
        })
        .eq('id', hero.id)
    })(),

    supabase
      .from('daily_missions')
      .update({ claimed: true })
      .eq('id', missionId),
  ])

  return res.status(200).json({
    ok: true,
    rewards: {
      gold: mission.reward_gold,
      mana: mission.reward_mana,
      xp:   mission.reward_xp,
    },
  })
}
