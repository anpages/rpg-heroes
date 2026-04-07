import { createClient } from '@supabase/supabase-js'
import { isUUID, safeHours } from './_validate.js'

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
  if (labLevel < rune.min_lab_level) {
    return res.status(400).json({ error: `Se necesita Laboratorio Nv.${rune.min_lab_level}` })
  }

  const resources = resourcesRes.data
  if (!resources) return res.status(500).json({ error: 'Sin recursos' })

  // Snapshot de recursos pasivos antes de modificar
  const nowMs = Date.now()
  const hours = safeHours(resources.last_collected_at, nowMs)
  const iron  = Math.floor((resources.iron ?? 0) + (resources.iron_rate ?? 0) * hours)
  const wood  = Math.floor((resources.wood ?? 0) + (resources.wood_rate ?? 0) * hours)
  const mana  = Math.floor((resources.mana ?? 0) + (resources.mana_rate ?? 0) * hours)
  const gold  = resources.gold ?? 0

  if (gold < rune.recipe_gold || wood < rune.recipe_wood || mana < rune.recipe_mana) {
    return res.status(400).json({ error: 'Recursos insuficientes' })
  }

  // Descontar recursos con snapshot
  const { error: rErr } = await supabase
    .from('resources')
    .update({
      gold: gold - rune.recipe_gold,
      wood: wood - rune.recipe_wood,
      mana: mana - rune.recipe_mana,
      iron,
      last_collected_at: new Date(nowMs).toISOString(),
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
