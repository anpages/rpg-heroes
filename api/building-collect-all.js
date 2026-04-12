import { requireAuth } from './_auth.js'
import {
  PRODUCTION_BUILDING_TYPES,
  buildingRateAndCap,
} from '../src/lib/gameConstants.js'

/**
 * POST /api/building-collect-all
 * Recolecta recursos de TODOS los edificios productivos en una sola llamada.
 * Soporta producción dual (recurso principal + secundario a partir de cierto nivel).
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  // Leer todos los edificios productivos
  const { data: buildings } = await supabase
    .from('buildings')
    .select('id, type, level, unlocked, production_collected_at')
    .eq('player_id', user.id)
    .in('type', PRODUCTION_BUILDING_TYPES)

  if (!buildings?.length) return res.status(200).json({ ok: true, collected: {} })

  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  // Calcular producción por edificio
  const totals = {}
  const details = []
  const buildingIds = []

  for (const b of buildings) {
    if (!b.unlocked || b.level <= 0) continue
    const { resource, rate, cap, secondary } = buildingRateAndCap(b.type, b.level)
    if (rate <= 0) continue

    const elapsed = Math.max(0, (nowMs - new Date(b.production_collected_at).getTime()) / 3_600_000)
    const produced = Math.min(Math.floor(rate * elapsed), cap)

    let secProduced = 0
    if (secondary) {
      secProduced = Math.min(Math.floor(secondary.rate * elapsed), secondary.cap)
    }

    if (produced <= 0 && secProduced <= 0) continue

    if (produced > 0) totals[resource] = (totals[resource] ?? 0) + produced
    if (secProduced > 0) totals[secondary.resource] = (totals[secondary.resource] ?? 0) + secProduced

    details.push({ type: b.type, resource, collected: produced, secondaryResource: secondary?.resource, secondaryCollected: secProduced })
    buildingIds.push(b.id)
  }

  const anyCollected = Object.values(totals).some(v => v > 0)
  if (!anyCollected) {
    return res.status(200).json({ ok: true, collected: {}, details: [], message: 'Nada que recolectar' })
  }

  // Sumar recursos atómicamente (sin CAS, sin race conditions)
  const rpcParams = { p_player_id: user.id }
  for (const [res, qty] of Object.entries(totals)) {
    if (qty > 0) rpcParams[`p_${res}`] = qty
  }

  const { error: rpcError } = await supabase.rpc('add_resources', rpcParams)
  if (rpcError) return res.status(500).json({ error: rpcError.message })

  // Marcar todos los edificios como recolectados
  if (buildingIds.length > 0) {
    await supabase
      .from('buildings')
      .update({ production_collected_at: nowIso })
      .in('id', buildingIds)
  }

  return res.status(200).json({ ok: true, collected: totals, details })
}
