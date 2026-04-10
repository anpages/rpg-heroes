import { requireAuth } from './_auth.js'
import { snapshotResources } from './_validate.js'
import { MAX_POTION_STACK } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { potionId } = req.body
  if (!potionId) return res.status(400).json({ error: 'potionId requerido' })
  if (typeof potionId !== 'string' || potionId.length > 50) return res.status(400).json({ error: 'potionId inválido' })

  // Verificar que esta poción no esté ya crafteándose
  const { data: activeCraft } = await supabase
    .from('player_potion_crafting')
    .select('craft_ends_at')
    .eq('player_id', user.id)
    .eq('potion_id', potionId)
    .maybeSingle()

  if (activeCraft && new Date(activeCraft.craft_ends_at) > new Date()) {
    return res.status(409).json({ error: 'Esta poción ya está en proceso.' })
  }

  // Obtener receta
  const { data: potion } = await supabase
    .from('potion_catalog')
    .select('*')
    .eq('id', potionId)
    .single()

  if (!potion) return res.status(404).json({ error: 'Poción no encontrada' })

  // Verificar nivel del Laboratorio
  const { data: lab } = await supabase
    .from('buildings')
    .select('level, unlocked')
    .eq('player_id', user.id)
    .eq('type', 'laboratory')
    .single()

  if (!lab || !lab.unlocked) return res.status(403).json({ error: 'El Laboratorio no está desbloqueado' })
  if (lab.level < potion.min_lab_level) return res.status(403).json({ error: `Requiere Laboratorio Nv.${potion.min_lab_level}` })

  // Verificar stack actual
  const { data: existing } = await supabase
    .from('player_potions')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('potion_id', potionId)
    .single()

  const currentQty = existing?.quantity ?? 0
  if (currentQty >= MAX_POTION_STACK) {
    return res.status(409).json({ error: `Ya tienes el máximo (${MAX_POTION_STACK}) de esta poción` })
  }

  // Verificar y descontar recursos
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, fragments, essence, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const snap = snapshotResources(resources)

  if (snap.gold      < potion.recipe_gold)      return res.status(402).json({ error: 'Oro insuficiente' })
  if (snap.wood      < potion.recipe_wood)      return res.status(402).json({ error: 'Madera insuficiente' })
  if (snap.mana      < potion.recipe_mana)      return res.status(402).json({ error: 'Maná insuficiente' })
  if (snap.fragments < (potion.recipe_fragments ?? 0)) return res.status(402).json({ error: 'Fragmentos insuficientes' })
  if (snap.essence   < (potion.recipe_essence   ?? 0)) return res.status(402).json({ error: 'Esencia insuficiente' })

  const craftMs = (potion.craft_minutes ?? 30) * 60 * 1000
  const craftEndsAt = new Date(Date.now() + craftMs).toISOString()

  const [resourcesResult, craftResult] = await Promise.all([
    supabase.from('resources').update({
      gold:      snap.gold      - potion.recipe_gold,
      iron:      snap.iron,
      wood:      snap.wood      - potion.recipe_wood,
      mana:      snap.mana      - potion.recipe_mana,
      fragments: snap.fragments - (potion.recipe_fragments ?? 0),
      essence:   snap.essence   - (potion.recipe_essence   ?? 0),
      last_collected_at: snap.nowIso,
    }).eq('player_id', user.id).eq('last_collected_at', snap.prevCollectedAt),

    supabase.from('player_potion_crafting').upsert(
      { player_id: user.id, potion_id: potionId, craft_ends_at: craftEndsAt },
      { onConflict: 'player_id,potion_id' }
    ),
  ])

  if (resourcesResult.error) return res.status(500).json({ error: resourcesResult.error.message })
  if (craftResult.error)    return res.status(500).json({ error: craftResult.error.message })

  return res.status(200).json({ ok: true, craft_ends_at: craftEndsAt })
}
