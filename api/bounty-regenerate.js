import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import {
  bountyRegenCost,
  BOUNTY_REGEN_MAX,
} from '../src/lib/gameConstants.js'
import { rollPool } from './bounty-state.js'

/**
 * Regenera el pool de rutas de caza pagando oro.
 *
 * Coste escalonado: primera regen más barata, cada siguiente más cara, máximo
 * BOUNTY_REGEN_MAX en la ventana diaria actual. Los regens no consumen el
 * reset_at — solo recambian las rutas y suben regens_today.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Propiedad del héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  // Cargar fila actual — bounty-state se habrá llamado antes (lazy-roll)
  const { data: hunt } = await supabase
    .from('bounty_hunts')
    .select('*')
    .eq('hero_id', heroId)
    .maybeSingle()

  if (!hunt) return res.status(404).json({ error: 'No hay rutas activas (llama primero a bounty-state)' })

  const regensUsed = hunt.regens_today ?? 0
  if (regensUsed >= BOUNTY_REGEN_MAX) {
    return res.status(409).json({ error: 'Has alcanzado el máximo de regeneraciones hoy' })
  }

  const cost = bountyRegenCost(regensUsed)
  if (cost == null) {
    return res.status(409).json({ error: 'No puedes regenerar más veces hoy' })
  }

  // Deducir oro (atómico via RPC)
  const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', { p_player_id: user.id, p_gold: cost })
  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  if (!ok) return res.status(402).json({ error: `Oro insuficiente (necesitas ${cost})` })

  // Rolar pool nuevo
  const newRoutes = rollPool()

  // Actualizar fila: pool nuevo + regens_today++ (dejamos reset_at intacto)
  const { error: updateError } = await supabase
    .from('bounty_hunts')
    .update({ routes: newRoutes, regens_today: regensUsed + 1 })
    .eq('hero_id', heroId)

  if (updateError) return res.status(500).json({ error: updateError.message })

  return res.status(200).json({
    ok:          true,
    routes:      newRoutes,
    regensToday: regensUsed + 1,
    goldSpent:   cost,
  })
}
