import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { MAX_POTION_STACK } from './_constants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { craftId } = req.body
  if (!craftId) return res.status(400).json({ error: 'craftId requerido' })
  if (!isUUID(craftId)) return res.status(400).json({ error: 'craftId inválido' })

  // Obtener crafteo activo por id (acotado al jugador para evitar leaks)
  const { data: craft } = await supabase
    .from('player_potion_crafting')
    .select('id, potion_id, craft_ends_at')
    .eq('id', craftId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!craft) return res.status(404).json({ error: 'Crafteo no encontrado' })
  if (new Date(craft.craft_ends_at) > new Date()) {
    return res.status(409).json({ error: 'La poción aún no está lista' })
  }

  const { potion_id: potionId } = craft

  // Verificar stack actual
  const { data: existing } = await supabase
    .from('player_potions')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('potion_id', potionId)
    .maybeSingle()

  const currentQty = existing?.quantity ?? 0
  if (currentQty >= MAX_POTION_STACK) {
    return res.status(409).json({ error: `Ya tienes el máximo (${MAX_POTION_STACK}) de esta poción` })
  }

  const [upsertResult, deleteResult] = await Promise.all([
    supabase.from('player_potions').upsert(
      { player_id: user.id, potion_id: potionId, quantity: currentQty + 1 },
      { onConflict: 'player_id,potion_id' }
    ),
    supabase.from('player_potion_crafting').delete().eq('id', craftId).eq('player_id', user.id),
  ])

  if (upsertResult.error) return res.status(500).json({ error: upsertResult.error.message })
  if (deleteResult.error) return res.status(500).json({ error: deleteResult.error.message })

  return res.status(200).json({ ok: true, potionId, quantity: currentQty + 1 })
}
