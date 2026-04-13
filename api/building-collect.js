import { requireAuth } from './_auth.js'
import { BUILDING_PRODUCTION, buildingRate } from '../src/lib/gameConstants.js'

/**
 * POST /api/building-collect
 * Recolecta recursos de un edificio productivo.
 * Body: { buildingType }
 *
 * Usa RPC atómica: SELECT FOR UPDATE + advance timestamp + add resources
 * en una sola transacción. Sin CAS, sin race conditions.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { buildingType } = req.body
  if (!buildingType || !BUILDING_PRODUCTION[buildingType]) {
    return res.status(400).json({ error: 'buildingType inválido' })
  }

  // Obtener nivel actual para calcular rate/cap
  const { data: building } = await supabase
    .from('buildings')
    .select('level, unlocked')
    .eq('player_id', user.id)
    .eq('type', buildingType)
    .single()

  if (!building) return res.status(404).json({ error: 'Edificio no encontrado' })
  if (!building.unlocked) return res.status(403).json({ error: 'Edificio no desbloqueado' })
  if (building.level <= 0) return res.status(409).json({ error: 'Edificio sin construir' })

  const { resource, rate, cap } = buildingRate(buildingType, building.level)
  if (rate <= 0) return res.status(409).json({ error: 'El edificio no produce nada a este nivel' })

  const { data: result, error: rpcError } = await supabase.rpc('collect_building_production', {
    p_player_id: user.id,
    p_building_type: buildingType,
    p_resource: resource,
    p_rate: rate,
    p_cap: cap,
  })

  if (rpcError) return res.status(500).json({ error: rpcError.message })

  return res.status(200).json(result)
}
