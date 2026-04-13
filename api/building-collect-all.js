import { requireAuth } from './_auth.js'
import { PRODUCTION_BUILDING_TYPES, buildingRate } from '../src/lib/gameConstants.js'

/**
 * POST /api/building-collect-all
 * Recolecta recursos de TODOS los edificios productivos en una sola llamada.
 *
 * Usa RPC atómica: FOR UPDATE en cada edificio + advance timestamps + add resources
 * en una sola transacción. Sin CAS, sin race conditions.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  // Leer niveles de todos los edificios productivos
  const { data: buildings } = await supabase
    .from('buildings')
    .select('type, level, unlocked')
    .eq('player_id', user.id)
    .in('type', PRODUCTION_BUILDING_TYPES)

  if (!buildings?.length) return res.status(200).json({ ok: true, collected: {}, details: [] })

  // Construir configs con rate/cap para cada edificio activo
  const configs = []
  for (const b of buildings) {
    if (!b.unlocked || b.level <= 0) continue
    const { resource, rate, cap } = buildingRate(b.type, b.level)
    if (rate <= 0) continue
    configs.push({ type: b.type, resource, rate, cap })
  }

  if (configs.length === 0) {
    return res.status(200).json({ ok: true, collected: {}, details: [] })
  }

  const { data: result, error: rpcError } = await supabase.rpc('collect_all_buildings_production', {
    p_player_id: user.id,
    p_configs: configs,
  })

  if (rpcError) return res.status(500).json({ error: rpcError.message })

  return res.status(200).json(result)
}
