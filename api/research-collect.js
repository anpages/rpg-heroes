import { requireAuth } from './_auth.js'
import { RESEARCH_NODES } from '../src/lib/gameConstants.js'

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

  return res.status(200).json({ ok: true, nodeId })
}
