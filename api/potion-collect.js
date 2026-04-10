import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { MAX_POTION_STACK } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', heroId)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const { potionId } = req.body
  if (!potionId) return res.status(400).json({ error: 'potionId requerido' })

  // Obtener crafteo activo de esta poción
  const { data: craft } = await supabase
    .from('potion_crafting')
    .select('potion_id, craft_ends_at')
    .eq('hero_id', heroId)
    .eq('potion_id', potionId)
    .maybeSingle()

  if (!craft) return res.status(404).json({ error: 'No hay ninguna poción en proceso' })
  if (new Date(craft.craft_ends_at) > new Date()) {
    return res.status(409).json({ error: 'La poción aún no está lista' })
  }

  // Verificar stack actual
  const { data: existing } = await supabase
    .from('hero_potions')
    .select('quantity')
    .eq('hero_id', heroId)
    .eq('potion_id', potionId)
    .single()

  const currentQty = existing?.quantity ?? 0
  if (currentQty >= MAX_POTION_STACK) {
    return res.status(409).json({ error: `Ya tienes el máximo (${MAX_POTION_STACK}) de esta poción` })
  }

  const [upsertResult, deleteResult] = await Promise.all([
    supabase.from('hero_potions').upsert(
      { hero_id: heroId, potion_id: potionId, quantity: currentQty + 1 },
      { onConflict: 'hero_id,potion_id' }
    ),
    supabase.from('potion_crafting').delete().eq('hero_id', heroId).eq('potion_id', potionId),
  ])

  if (upsertResult.error) return res.status(500).json({ error: upsertResult.error.message })
  if (deleteResult.error) return res.status(500).json({ error: deleteResult.error.message })

  return res.status(200).json({ ok: true, potionId, quantity: currentQty + 1 })
}
