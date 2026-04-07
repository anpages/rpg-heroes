import { createClient } from '@supabase/supabase-js'
import { safeHours } from './_validate.js'
import { RESEARCH_NODES } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

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

  // Verificar que no hay investigación activa en curso
  const { data: active } = await supabase
    .from('player_research')
    .select('node_id, ends_at')
    .eq('player_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (active && new Date(active.ends_at) > new Date()) {
    return res.status(409).json({ error: 'Ya hay una investigación en curso', activeNodeId: active.node_id })
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

  // Snapshot de recursos y verificar costes
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (resourcesError || !resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const nowMs        = Date.now()
  const hours        = safeHours(resources.last_collected_at, nowMs)
  const curGold      = Math.floor(resources.gold + resources.gold_rate * hours)
  const curIron      = Math.floor(resources.iron + resources.iron_rate * hours)
  const curWood      = Math.floor(resources.wood + resources.wood_rate * hours)
  const curMana      = Math.floor(resources.mana + resources.mana_rate * hours)

  const { cost } = node
  if (curGold < cost.gold) return res.status(402).json({ error: `Oro insuficiente (necesitas ${cost.gold})` })
  if (curIron < cost.iron) return res.status(402).json({ error: `Hierro insuficiente (necesitas ${cost.iron})` })
  if (curMana < cost.mana) return res.status(402).json({ error: `Maná insuficiente (necesitas ${cost.mana})` })

  // Descontar recursos
  const { error: updateError } = await supabase
    .from('resources')
    .update({
      gold: curGold - cost.gold,
      iron: curIron - cost.iron,
      wood: curWood,
      mana: curMana - cost.mana,
      last_collected_at: new Date(nowMs).toISOString(),
    })
    .eq('player_id', user.id)

  if (updateError) return res.status(500).json({ error: updateError.message })

  // Calcular ends_at
  const endsAt = new Date(nowMs + node.duration_hours * 3_600_000)

  // Upsert (si había una fila activa expirada o nueva)
  const { error: insertError } = await supabase
    .from('player_research')
    .upsert(
      {
        player_id:  user.id,
        node_id:    nodeId,
        status:     'active',
        started_at: new Date(nowMs).toISOString(),
        ends_at:    endsAt.toISOString(),
      },
      { onConflict: 'player_id,node_id' }
    )

  if (insertError) return res.status(500).json({ error: insertError.message })

  return res.status(200).json({ ok: true, nodeId, endsAt: endsAt.toISOString() })
}
