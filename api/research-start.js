import { requireAuth } from './_auth.js'
import { RESEARCH_NODES } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { nodeId } = req.body
  if (!nodeId) return res.status(400).json({ error: 'nodeId requerido' })

  // Validar que el nodo existe
  const node = RESEARCH_NODES.find(n => n.id === nodeId)
  if (!node) return res.status(404).json({ error: 'Nodo de investigación no encontrado' })

  // Verificar que el jugador tiene Biblioteca desbloqueada
  const { data: library } = await supabase
    .from('buildings')
    .select('level, unlocked')
    .eq('player_id', user.id)
    .eq('type', 'library')
    .maybeSingle()

  if (!library || !library.unlocked) {
    return res.status(403).json({ error: 'La Biblioteca no está desbloqueada' })
  }

  // Verificar nivel de Biblioteca requerido para el nodo
  const libLevelRequired = node.library_level_required ?? 1
  if (library.level < libLevelRequired) {
    return res.status(403).json({ error: `Requiere Biblioteca Nv.${libLevelRequired}` })
  }

  // Verificar que no hay investigación activa ni la biblioteca mejorando
  const queueNow = new Date().toISOString()
  const [{ data: active }, { data: busyLibrary }] = await Promise.all([
    supabase.from('player_research').select('node_id, ends_at').eq('player_id', user.id).eq('status', 'active').maybeSingle(),
    supabase.from('buildings').select('id').eq('player_id', user.id).eq('type', 'library').gt('upgrade_ends_at', queueNow).limit(1),
  ])

  if (active && new Date(active.ends_at) > new Date()) {
    return res.status(409).json({ error: 'Ya hay una investigación en curso', activeNodeId: active.node_id })
  }
  if (busyLibrary?.length > 0) {
    return res.status(409).json({ error: 'La Biblioteca se está mejorando. Espera a que termine.' })
  }

  // Verificar que el nodo no fue ya completado
  const { data: existing } = await supabase
    .from('player_research')
    .select('status')
    .eq('player_id', user.id)
    .eq('node_id', nodeId)
    .maybeSingle()

  if (existing?.status === 'completed') {
    return res.status(409).json({ error: 'Esta investigación ya está completada' })
  }

  // Verificar prerequisito
  if (node.prerequisite) {
    const { data: prereq } = await supabase
      .from('player_research')
      .select('status')
      .eq('player_id', user.id)
      .eq('node_id', node.prerequisite)
      .maybeSingle()

    if (!prereq || prereq.status !== 'completed') {
      const prereqNode = RESEARCH_NODES.find(n => n.id === node.prerequisite)
      return res.status(403).json({ error: `Requiere completar "${prereqNode?.name ?? node.prerequisite}" primero` })
    }
  }

  // Deducir recursos (atómico via RPC)
  const { cost } = node
  const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', {
    p_player_id: user.id, p_gold: cost.gold, p_iron: cost.iron, p_mana: cost.mana,
  })
  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  if (!ok) return res.status(402).json({ error: 'Recursos insuficientes' })

  // Calcular ends_at
  const endsAt = new Date(Date.now() + node.duration_hours * 3_600_000)

  // Upsert (si había una fila activa expirada o nueva)
  const { error: insertError } = await supabase
    .from('player_research')
    .upsert(
      {
        player_id:  user.id,
        node_id:    nodeId,
        status:     'active',
        started_at: snap.nowIso,
        ends_at:    endsAt.toISOString(),
      },
      { onConflict: 'player_id,node_id' }
    )

  if (insertError) return res.status(500).json({ error: insertError.message })

  return res.status(200).json({ ok: true, nodeId, endsAt: endsAt.toISOString() })
}
