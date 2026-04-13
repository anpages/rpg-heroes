import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

/**
 * POST /api/missions-claim
 * Reclama la recompensa de una misión diaria completada.
 * Body: { missionId: uuid }
 *
 * Usa RPC atómica: oro + XP (con level-up) + marcar claimed en una transacción.
 */
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
    .select('id')
    .eq('player_id', user.id)
    .order('slot')
  const hero = heroes?.[0]

  if (!hero) return res.status(500).json({ error: 'Error al obtener datos' })

  const { data: result, error: rpcErr } = await supabase.rpc('claim_mission_atomic', {
    p_player_id: user.id,
    p_hero_id: hero.id,
    p_mission_id: missionId,
    p_gold: mission.reward_gold,
    p_xp: mission.reward_xp,
  })

  if (rpcErr) return res.status(500).json({ error: rpcErr.message })

  return res.status(200).json({
    ok: true,
    rewards: {
      gold: mission.reward_gold,
      xp:   mission.reward_xp,
    },
    levelUp: result?.level_up ?? false,
  })
}
