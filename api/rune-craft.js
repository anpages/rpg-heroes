import { requireAuth } from './_auth.js'
import { snapshotResources } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { runeId } = req.body
  if (!runeId || typeof runeId !== 'number' || !Number.isInteger(runeId) || runeId < 1) return res.status(400).json({ error: 'runeId inválido' })

  // Verificar que esta runa no esté ya crafteándose
  const { data: activeCraft } = await supabase
    .from('player_rune_crafting')
    .select('craft_ends_at')
    .eq('player_id', user.id)
    .eq('rune_id', runeId)
    .maybeSingle()

  if (activeCraft && new Date(activeCraft.craft_ends_at) > new Date()) {
    return res.status(409).json({ error: 'Esta runa ya está en proceso.' })
  }

  const [runeRes, labRes, resourcesRes] = await Promise.all([
    supabase.from('rune_catalog').select('*').eq('id', runeId).maybeSingle(),
    supabase.from('buildings').select('level').eq('player_id', user.id).eq('type', 'laboratory').maybeSingle(),
    supabase.from('resources').select('*').eq('player_id', user.id).single(),
  ])

  const rune = runeRes.data
  if (!rune) return res.status(404).json({ error: 'Runa no encontrada' })

  const labLevel = labRes.data?.level ?? 0

  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)
  const effectiveLabLevel = labLevel + rb.lab_req_reduction

  if (effectiveLabLevel < rune.min_lab_level) {
    const neededLevel = Math.max(1, rune.min_lab_level - rb.lab_req_reduction)
    return res.status(400).json({ error: `Se necesita Laboratorio Nv.${neededLevel}` })
  }

  const resources = resourcesRes.data
  if (!resources) return res.status(500).json({ error: 'Sin recursos' })

  const snap = snapshotResources(resources)

  if (snap.gold      < (rune.recipe_gold      ?? 0))    return res.status(400).json({ error: 'Oro insuficiente' })
  if (snap.wood      < (rune.recipe_wood      ?? 0))    return res.status(400).json({ error: 'Madera insuficiente' })
  if (snap.mana      < (rune.recipe_mana      ?? 0))    return res.status(400).json({ error: 'Maná insuficiente' })
  if (snap.fragments < (rune.recipe_fragments ?? 0))    return res.status(400).json({ error: 'Fragmentos insuficientes' })
  if (snap.essence   < (rune.recipe_essence   ?? 0))    return res.status(400).json({ error: 'Esencia insuficiente' })

  const craftMs = (rune.craft_minutes ?? 60) * 60 * 1000
  const craftEndsAt = new Date(Date.now() + craftMs).toISOString()

  const [resourcesResult, craftResult] = await Promise.all([
    supabase.from('resources').update({
      iron:      snap.iron,
      gold:      snap.gold      - (rune.recipe_gold    ?? 0),
      wood:      snap.wood      - (rune.recipe_wood    ?? 0),
      mana:      snap.mana      - (rune.recipe_mana    ?? 0),
      fragments: snap.fragments - (rune.recipe_fragments ?? 0),
      essence:   snap.essence   - (rune.recipe_essence   ?? 0),
      last_collected_at: snap.nowIso,
    }).eq('player_id', user.id).eq('last_collected_at', snap.prevCollectedAt),

    supabase.from('player_rune_crafting').upsert(
      { player_id: user.id, rune_id: runeId, craft_ends_at: craftEndsAt },
      { onConflict: 'player_id,rune_id' }
    ),
  ])

  if (resourcesResult.error) return res.status(500).json({ error: resourcesResult.error.message })
  if (craftResult.error)     return res.status(500).json({ error: craftResult.error.message })

  return res.status(200).json({ ok: true, craft_ends_at: craftEndsAt })
}
