import { requireAuth } from './_auth.js'
import {
  BUILDING_PRODUCTION,
  buildingRateAndCap,
} from '../src/lib/gameConstants.js'

/**
 * POST /api/building-collect
 * Recolecta los recursos acumulados en un edificio productivo.
 * Soporta producción dual: recurso principal + secundario (a partir de cierto nivel).
 * Body: { buildingType: 'gold_mine' | 'lumber_mill' | 'mana_well' | 'herb_garden' }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { buildingType } = req.body
  if (!buildingType || !BUILDING_PRODUCTION[buildingType]) {
    return res.status(400).json({ error: 'buildingType inválido' })
  }

  // Leer edificio
  const { data: building } = await supabase
    .from('buildings')
    .select('id, type, level, unlocked, production_collected_at')
    .eq('player_id', user.id)
    .eq('type', buildingType)
    .single()

  if (!building) return res.status(404).json({ error: 'Edificio no encontrado' })
  if (!building.unlocked) return res.status(403).json({ error: 'Edificio no desbloqueado' })
  if (building.level <= 0) return res.status(409).json({ error: 'Edificio sin construir' })

  const { resource, rate, cap, secondary } = buildingRateAndCap(buildingType, building.level)
  if (rate <= 0) return res.status(409).json({ error: 'El edificio no produce nada a este nivel' })

  // Calcular producción acumulada
  const collectedAt = new Date(building.production_collected_at)
  const nowMs = Date.now()
  const elapsedHours = Math.max(0, (nowMs - collectedAt.getTime()) / 3_600_000)
  const produced = Math.min(Math.floor(rate * elapsedHours), cap)

  let secProduced = 0
  if (secondary) {
    secProduced = Math.min(Math.floor(secondary.rate * elapsedHours), secondary.cap)
  }

  if (produced <= 0 && secProduced <= 0) {
    return res.status(200).json({ ok: true, collected: 0, resource, message: 'Nada que recolectar todavía' })
  }

  const nowIso = new Date(nowMs).toISOString()

  // Marcar edificio como recolectado CON CAS para evitar doble-recolección
  const { error: bldError, count: bldCount } = await supabase
    .from('buildings')
    .update({ production_collected_at: nowIso })
    .eq('id', building.id)
    .eq('production_collected_at', building.production_collected_at)

  if (bldError) return res.status(500).json({ error: bldError.message })
  if (bldCount === 0) return res.status(200).json({ ok: true, collected: 0, resource, message: 'Ya recolectado' })

  // Sumar recursos atómicamente (sin CAS, sin race conditions)
  const rpcParams = { p_player_id: user.id }
  if (produced > 0) rpcParams[`p_${resource}`] = produced
  if (secProduced > 0) rpcParams[`p_${secondary.resource}`] = secProduced

  const { error: rpcError } = await supabase.rpc('add_resources', rpcParams)
  if (rpcError) return res.status(500).json({ error: rpcError.message })

  const result = { ok: true, collected: produced, resource }
  if (secProduced > 0) {
    result.secondaryCollected = secProduced
    result.secondaryResource = secondary.resource
  }

  return res.status(200).json(result)
}
