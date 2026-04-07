import { createClient } from '@supabase/supabase-js'
import { isUUID, safeHours } from './_validate.js'

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
  if (!isUUID(missionId)) return res.status(400).json({ error: 'missionId inválido' })

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

  // Obtener héroe para XP (el de menor slot si hay varios)
  const { data: heroes } = await supabase
    .from('heroes')
    .select('id, experience, level')
    .eq('player_id', user.id)
    .order('slot')
  const hero = heroes?.[0]

  // Obtener recursos (con rates para interpolar el idle acumulado y hacer snapshot)
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!hero || !resources) return res.status(500).json({ error: 'Error al obtener datos' })

  // Snapshot de todos los recursos antes de mover last_collected_at
  const nowMs = Date.now()
  const hours = safeHours(resources.last_collected_at, nowMs)
  const currentGold = Math.floor(resources.gold + resources.gold_rate * hours)
  const snapshotIron = Math.floor(resources.iron + resources.iron_rate * hours)
  const snapshotWood = Math.floor(resources.wood + resources.wood_rate * hours)
  const snapshotMana = Math.floor(resources.mana + resources.mana_rate * hours)

  // Aplicar recompensas — misiones solo dan oro y XP
  await Promise.all([
    supabase
      .from('resources')
      .update({
        gold: currentGold + mission.reward_gold,
        iron: snapshotIron,
        wood: snapshotWood,
        mana: snapshotMana,
        last_collected_at: new Date(nowMs).toISOString(),
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
      xp:   mission.reward_xp,
    },
  })
}
