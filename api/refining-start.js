import { requireAuth } from './_auth.js'
import { refiningCraftMinutes } from './_constants.js'

/**
 * POST /api/refining-start
 * Inicia o añade unidades a un slot de refinado.
 * Body: { recipeId: string, quantity: number }
 *
 * Sin límite de slots ni de recetas en paralelo.
 * Si ya existe un slot para esta receta en este edificio, añade quantity.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { recipeId, quantity = 1 } = req.body
  if (!recipeId) return res.status(400).json({ error: 'recipeId requerido' })
  const qty = Math.max(1, Math.min(99, Math.floor(quantity)))

  // Leer receta
  const { data: recipe } = await supabase
    .from('crafting_catalog')
    .select('*')
    .eq('id', recipeId)
    .single()

  if (!recipe) return res.status(404).json({ error: 'Receta no encontrada' })
  if (!recipe.refinery_type) return res.status(400).json({ error: 'Esta receta no es de refinado' })

  // Validar edificio
  const { data: refinery } = await supabase
    .from('buildings')
    .select('level, unlocked')
    .eq('player_id', user.id)
    .eq('type', recipe.refinery_type)
    .single()

  const refineryLevel = (refinery?.unlocked && refinery?.level) || 0
  if (refineryLevel < (recipe.min_refinery_level ?? 1)) {
    return res.status(403).json({ error: `Necesitas ${recipe.refinery_type} nivel ${recipe.min_refinery_level}` })
  }

  // Calcular duración efectiva por unidad
  const effectiveMinutes = refiningCraftMinutes(recipe.craft_minutes, recipe.min_refinery_level ?? 1, refineryLevel)
  const unitDurationMs = Math.round(effectiveMinutes * 60 * 1000)

  // Validar recursos para qty unidades
  const inputs = recipe.inputs ?? []
  const resourceInputs = inputs.filter(i => i.resource)
  const itemInputs = inputs.filter(i => i.item)

  // Deducir recursos
  if (resourceInputs.length > 0) {
    const deductArgs = { p_player_id: user.id }
    for (const { resource, qty: perUnit } of resourceInputs) deductArgs[`p_${resource}`] = perUnit * qty
    const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', deductArgs)
    if (rpcErr) return res.status(500).json({ error: rpcErr.message })
    if (!ok) return res.status(409).json({ error: 'Recursos insuficientes' })
  }

  // Deducir items crafteados
  if (itemInputs.length > 0) {
    for (const { item, qty: perUnit } of itemInputs) {
      const { data: row } = await supabase
        .from('player_crafted_items')
        .select('quantity')
        .eq('player_id', user.id)
        .eq('recipe_id', item)
        .maybeSingle()
      const available = row?.quantity ?? 0
      if (available < perUnit * qty) {
        return res.status(409).json({ error: `Material insuficiente: ${item}` })
      }
      await supabase
        .from('player_crafted_items')
        .update({ quantity: available - perUnit * qty })
        .eq('player_id', user.id)
        .eq('recipe_id', item)
    }
  }

  // Upsert slot: si ya existe, añadir quantity; si no, crear
  const { data: existing } = await supabase
    .from('player_refining_slots')
    .select('id, quantity, craft_started_at, unit_duration_ms')
    .eq('player_id', user.id)
    .eq('building_type', recipe.refinery_type)
    .eq('recipe_id', recipeId)
    .maybeSingle()

  if (existing) {
    // Añadir unidades al slot existente
    const { error } = await supabase
      .from('player_refining_slots')
      .update({ quantity: existing.quantity + qty, unit_duration_ms: unitDurationMs })
      .eq('id', existing.id)
    if (error) return res.status(500).json({ error: error.message })
  } else {
    // Crear nuevo slot
    const { error } = await supabase
      .from('player_refining_slots')
      .insert({
        player_id: user.id,
        building_type: recipe.refinery_type,
        recipe_id: recipeId,
        quantity: qty,
        craft_started_at: new Date().toISOString(),
        unit_duration_ms: unitDurationMs,
      })
    if (error) return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true })
}
