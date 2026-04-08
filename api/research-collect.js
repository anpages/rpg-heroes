import { requireAuth } from './_auth.js'
import { snapshotResources } from './_validate.js'
import { RESEARCH_NODES, computeProductionRates } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { nodeId } = req.body
  if (!nodeId) return res.status(400).json({ error: 'nodeId requerido' })

  const node = RESEARCH_NODES.find(n => n.id === nodeId)
  if (!node) return res.status(404).json({ error: 'Nodo de investigación no encontrado' })

  // Buscar la fila activa
  const { data: row, error: rowError } = await supabase
    .from('player_research')
    .select('id, status, ends_at')
    .eq('player_id', user.id)
    .eq('node_id', nodeId)
    .maybeSingle()

  if (rowError) return res.status(500).json({ error: rowError.message })
  if (!row)                           return res.status(404).json({ error: 'Investigación no encontrada' })
  if (row.status !== 'active')        return res.status(409).json({ error: 'La investigación no está en curso' })
  if (new Date(row.ends_at) > new Date()) return res.status(409).json({ error: 'La investigación aún no ha terminado' })

  // Marcar como completada
  const { error: updateError } = await supabase
    .from('player_research')
    .update({ status: 'completed' })
    .eq('id', row.id)

  if (updateError) return res.status(500).json({ error: updateError.message })

  // Si el nodo afecta mana_rate_pct, recalcular y actualizar mana_rate en resources
  if (node.effect_type === 'mana_rate_pct') {
    const [buildingsRes, resourcesRes] = await Promise.all([
      supabase.from('buildings').select('type, level, unlocked').eq('player_id', user.id),
      supabase.from('resources').select('iron, wood, mana, iron_rate, wood_rate, mana_rate, last_collected_at').eq('player_id', user.id).single(),
    ])

    const allBuildings = buildingsRes.data ?? []
    const resources    = resourcesRes.data

    if (resources) {
      // Calcular tasas base desde edificios
      const baseRates = computeProductionRates(allBuildings)

      // Determinar total de mana_rate_pct completado (incluye el que acabamos de completar)
      const { data: completedRows } = await supabase
        .from('player_research')
        .select('node_id')
        .eq('player_id', user.id)
        .eq('status', 'completed')

      const completedIds  = new Set((completedRows ?? []).map(r => r.node_id))
      let totalManaRatePct = 0
      for (const n of RESEARCH_NODES) {
        if (completedIds.has(n.id) && n.effect_type === 'mana_rate_pct') {
          totalManaRatePct += n.effect_value
        }
      }

      const newManaRate = Math.round(baseRates.mana_rate * (1 + totalManaRatePct))

      const snap = snapshotResources(resources)
      await supabase
        .from('resources')
        .update({
          mana_rate: newManaRate,
          iron:      snap.iron,
          wood:      snap.wood,
          mana:      snap.mana,
          last_collected_at: snap.nowIso,
        })
        .eq('player_id', user.id)
    }
  }

  return res.status(200).json({ ok: true, nodeId })
}
