import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { xpRequiredForLevel } from '../src/lib/gameFormulas.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

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

  const snap = snapshotResources(resources)

  // Aplicar recompensas — misiones solo dan oro y XP
  await Promise.all([
    supabase
      .from('resources')
      .update({
        gold: snap.gold + mission.reward_gold,
        iron: snap.iron,
        wood: snap.wood,
        mana: snap.mana,
        last_collected_at: snap.nowIso,
      })
      .eq('player_id', user.id),

    (() => {
      const newXp = hero.experience + mission.reward_xp
      const xpForLevel = xpRequiredForLevel(hero.level)
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
