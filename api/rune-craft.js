import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { RUNE_CRAFT_DURATION_MS } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, runeId } = req.body
  if (!heroId || !isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })
  if (!runeId) return res.status(400).json({ error: 'runeId requerido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes').select('id').eq('id', heroId).eq('player_id', user.id).maybeSingle()
  if (!hero) return res.status(403).json({ error: 'Forbidden' })

  // Verificar que no haya un crafteo de runa en curso
  const { data: activeCraft } = await supabase
    .from('rune_crafting')
    .select('rune_id, craft_ends_at')
    .eq('hero_id', heroId)
    .single()

  if (activeCraft && new Date(activeCraft.craft_ends_at) > new Date()) {
    return res.status(409).json({ error: 'Ya hay una runa en proceso. Espera a que termine.' })
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

  if (snap.fragments < (rune.recipe_fragments ?? 0))    return res.status(400).json({ error: 'Fragmentos insuficientes' })
  if (snap.essence   < (rune.recipe_essence   ?? 0))    return res.status(400).json({ error: 'Esencia insuficiente' })

  const craftEndsAt = new Date(Date.now() + RUNE_CRAFT_DURATION_MS).toISOString()

  const [resourcesResult, craftResult] = await Promise.all([
    supabase.from('resources').update({
      iron:      snap.iron,
      gold:      snap.gold,
      wood:      snap.wood,
      mana:      snap.mana,
      fragments: snap.fragments - (rune.recipe_fragments ?? 0),
      essence:   snap.essence   - (rune.recipe_essence   ?? 0),
      last_collected_at: snap.nowIso,
    }).eq('player_id', user.id),

    supabase.from('rune_crafting').upsert(
      { hero_id: heroId, rune_id: runeId, craft_ends_at: craftEndsAt },
      { onConflict: 'hero_id' }
    ),
  ])

  if (resourcesResult.error) return res.status(500).json({ error: resourcesResult.error.message })
  if (craftResult.error)     return res.status(500).json({ error: craftResult.error.message })

  return res.status(200).json({ ok: true, craft_ends_at: craftEndsAt })
}
