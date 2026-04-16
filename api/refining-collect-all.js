import { requireAuth } from './_auth.js'

/**
 * POST /api/refining-collect-all
 * Recoge todos los items completados de los slots del laboratorio.
 * Body: { buildingType: 'laboratory' }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { buildingType } = req.body
  if (!buildingType) return res.status(400).json({ error: 'buildingType requerido' })

  const query = supabase
    .from('player_refining_slots')
    .select('*')
    .eq('player_id', user.id)
    .eq('building_type', buildingType)

  const { data: slots } = await query
  if (!slots || slots.length === 0) {
    return res.status(200).json({ ok: true, collected: [] })
  }

  const now = Date.now()
  const collected = []

  for (const slot of slots) {
    const startedAt = new Date(slot.craft_started_at).getTime()
    const elapsedMs = now - startedAt
    const completed = Math.min(slot.quantity, Math.floor(elapsedMs / slot.unit_duration_ms))

    if (completed <= 0) continue

    // Leer receta para output_qty
    const { data: recipe } = await supabase
      .from('crafting_catalog')
      .select('output_qty, name')
      .eq('id', slot.recipe_id)
      .single()

    const outputPerUnit = recipe?.output_qty ?? 1
    const totalOutput = completed * outputPerUnit

    // Añadir al inventario
    const { data: existing } = await supabase
      .from('player_crafted_items')
      .select('quantity')
      .eq('player_id', user.id)
      .eq('recipe_id', slot.recipe_id)
      .maybeSingle()

    const currentQty = existing?.quantity ?? 0
    const { error: upsertErr } = await supabase
      .from('player_crafted_items')
      .upsert({
        player_id: user.id,
        recipe_id: slot.recipe_id,
        quantity: currentQty + totalOutput,
      }, { onConflict: 'player_id,recipe_id' })

    if (upsertErr) return res.status(500).json({ error: upsertErr.message })

    // Actualizar o eliminar slot
    const remaining = slot.quantity - completed
    if (remaining <= 0) {
      await supabase.from('player_refining_slots').delete().eq('id', slot.id)
    } else {
      const newStartedAt = new Date(startedAt + completed * slot.unit_duration_ms).toISOString()
      await supabase
        .from('player_refining_slots')
        .update({ quantity: remaining, craft_started_at: newStartedAt })
        .eq('id', slot.id)
    }

    collected.push({
      item: slot.recipe_id,
      name: recipe?.name ?? slot.recipe_id,
      collected: totalOutput,
    })
  }

  return res.status(200).json({ ok: true, collected })
}
