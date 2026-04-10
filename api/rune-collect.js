import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId || !isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes').select('id').eq('id', heroId).eq('player_id', user.id).maybeSingle()
  if (!hero) return res.status(403).json({ error: 'Forbidden' })

  const { runeId } = req.body
  if (!runeId) return res.status(400).json({ error: 'runeId requerido' })

  // Obtener crafteo activo de esta runa
  const { data: craft } = await supabase
    .from('rune_crafting')
    .select('rune_id, craft_ends_at')
    .eq('hero_id', heroId)
    .eq('rune_id', runeId)
    .maybeSingle()

  if (!craft) return res.status(404).json({ error: 'No hay ninguna runa en proceso' })
  if (new Date(craft.craft_ends_at) > new Date()) {
    return res.status(409).json({ error: 'La runa aún no está lista' })
  }

  // Incrementar inventario de runas
  const { data: existing } = await supabase
    .from('hero_runes').select('id, quantity')
    .eq('hero_id', heroId).eq('rune_id', runeId).maybeSingle()

  const [upsertResult, deleteResult] = await Promise.all([
    existing
      ? supabase.from('hero_runes').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
      : supabase.from('hero_runes').insert({ hero_id: heroId, rune_id: runeId, quantity: 1 }),
    supabase.from('rune_crafting').delete().eq('hero_id', heroId).eq('rune_id', runeId),
  ])

  if (upsertResult.error) return res.status(500).json({ error: upsertResult.error.message })
  if (deleteResult.error) return res.status(500).json({ error: deleteResult.error.message })

  return res.status(200).json({ ok: true, runeId })
}
