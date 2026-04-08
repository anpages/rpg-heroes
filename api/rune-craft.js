import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'

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

  const [runeRes, labRes, resourcesRes] = await Promise.all([
    supabase.from('rune_catalog').select('*').eq('id', runeId).maybeSingle(),
    supabase.from('buildings').select('level').eq('player_id', user.id).eq('type', 'laboratory').maybeSingle(),
    supabase.from('resources').select('*').eq('player_id', user.id).single(),
  ])

  const rune = runeRes.data
  if (!rune) return res.status(404).json({ error: 'Runa no encontrada' })

  const labLevel = labRes.data?.level ?? 0

  // Investigación: lab_req_reduction puede reducir el nivel de lab requerido para craftear runas
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

  if (snap.gold < rune.recipe_gold || snap.wood < rune.recipe_wood || snap.mana < rune.recipe_mana) {
    return res.status(400).json({ error: 'Recursos insuficientes' })
  }

  const { error: rErr } = await supabase
    .from('resources')
    .update({
      gold: snap.gold - rune.recipe_gold,
      wood: snap.wood - rune.recipe_wood,
      mana: snap.mana - rune.recipe_mana,
      iron: snap.iron,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)

  if (rErr) return res.status(500).json({ error: rErr.message })

  // Upsert hero_runes (incrementar cantidad o insertar nuevo)
  const { data: existing } = await supabase
    .from('hero_runes').select('id, quantity')
    .eq('hero_id', heroId).eq('rune_id', runeId).maybeSingle()

  if (existing) {
    await supabase.from('hero_runes').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
  } else {
    await supabase.from('hero_runes').insert({ hero_id: heroId, rune_id: runeId, quantity: 1 })
  }

  return res.json({ ok: true })
}
