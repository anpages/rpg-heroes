import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

/**
 * POST /api/craft-collect
 * Recoge un item cuyo crafteo ha terminado.
 * Body: { craftId: uuid }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { craftId } = req.body
  if (!craftId || !isUUID(craftId)) return res.status(400).json({ error: 'craftId inválido' })

  // Leer craft de la cola
  const { data: craft } = await supabase
    .from('player_crafting_queue')
    .select('id, player_id, recipe_id, craft_ends_at')
    .eq('id', craftId)
    .single()

  if (!craft) return res.status(404).json({ error: 'Craft no encontrado' })
  if (craft.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (new Date(craft.craft_ends_at) > new Date()) {
    return res.status(409).json({ error: 'El crafteo aún no ha terminado' })
  }

  // Leer receta para output_qty
  const { data: recipe } = await supabase
    .from('crafting_catalog')
    .select('id, name, output_qty')
    .eq('id', craft.recipe_id)
    .single()

  const outputQty = recipe?.output_qty ?? 1

  // Leer cantidad actual
  const { data: existing } = await supabase
    .from('player_crafted_items')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('recipe_id', craft.recipe_id)
    .maybeSingle()

  const currentQty = existing?.quantity ?? 0

  // Upsert inventario + eliminar de cola (en paralelo)
  const [{ error: upsertError }, { error: deleteError }] = await Promise.all([
    supabase
      .from('player_crafted_items')
      .upsert({
        player_id: user.id,
        recipe_id: craft.recipe_id,
        quantity:  currentQty + outputQty,
      }, { onConflict: 'player_id,recipe_id' }),
    supabase
      .from('player_crafting_queue')
      .delete()
      .eq('id', craftId),
  ])

  if (upsertError) return res.status(500).json({ error: upsertError.message })
  if (deleteError) return res.status(500).json({ error: deleteError.message })

  return res.status(200).json({
    ok: true,
    item: craft.recipe_id,
    name: recipe?.name ?? craft.recipe_id,
    quantity: currentQty + outputQty,
  })
}
