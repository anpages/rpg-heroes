import { requireAuth } from './_auth.js'
import { CRAFTING_SLOTS_BASE, REFINING_SLOTS_BASE, REFINING_SLOTS_EXPANDED_LEVEL } from './_constants.js'

/**
 * POST /api/craft-start
 * Inicia el crafteo de un item del catálogo de crafteo (refinado, repair kits, forge stones, etc.).
 * Body: { recipeId: string }
 *
 * Los inputs de cada receta pueden ser:
 *  - { resource: "iron", qty: 3 }  → se deduce de la tabla `resources`
 *  - { item: "steel_ingot", qty: 2 } → se deduce de `player_crafted_items`
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { recipeId } = req.body
  if (!recipeId) return res.status(400).json({ error: 'recipeId requerido' })

  // Leer receta
  const { data: recipe } = await supabase
    .from('crafting_catalog')
    .select('*')
    .eq('id', recipeId)
    .single()

  if (!recipe) return res.status(404).json({ error: 'Receta no encontrada' })

  const isRefining = !!recipe.refinery_type

  if (isRefining) {
    // ── Refinado: validar contra el edificio de refinado ──────────────────────
    const { data: refinery } = await supabase
      .from('buildings')
      .select('level, unlocked')
      .eq('player_id', user.id)
      .eq('type', recipe.refinery_type)
      .single()

    const refineryLevel = (refinery?.unlocked && refinery?.level) || 0
    if (refineryLevel < (recipe.min_refinery_level ?? 1)) {
      return res.status(403).json({ error: `Necesitas el edificio de refinado nivel ${recipe.min_refinery_level}` })
    }

    // Cola específica del edificio de refinado
    const { data: queue } = await supabase
      .from('player_crafting_queue')
      .select('id')
      .eq('player_id', user.id)
      .eq('building_type', recipe.refinery_type)

    const maxSlots = refineryLevel >= REFINING_SLOTS_EXPANDED_LEVEL ? 2 : REFINING_SLOTS_BASE
    if ((queue?.length ?? 0) >= maxSlots) {
      return res.status(409).json({ error: 'Slot de refinado ocupado' })
    }
  } else {
    // ── Taller: validar contra el laboratorio ─────────────────────────────────
    const { data: lab } = await supabase
      .from('buildings')
      .select('level, unlocked')
      .eq('player_id', user.id)
      .eq('type', 'laboratory')
      .single()

    const labLevel = (lab?.unlocked && lab?.level) || 0
    if (labLevel < recipe.min_lab_level) {
      return res.status(403).json({ error: `Necesitas Laboratorio nivel ${recipe.min_lab_level}` })
    }

    // Cola del Taller (building_type IS NULL)
    const { data: queue } = await supabase
      .from('player_crafting_queue')
      .select('id')
      .eq('player_id', user.id)
      .is('building_type', null)

    if ((queue?.length ?? 0) >= CRAFTING_SLOTS_BASE) {
      return res.status(409).json({ error: `Todos los slots de crafteo están ocupados (${CRAFTING_SLOTS_BASE})` })
    }
  }

  const inputs = recipe.inputs ?? []
  const resourceInputs = inputs.filter(i => i.resource)
  const itemInputs     = inputs.filter(i => i.item)

  // ── Validar y deducir recursos (atómico via RPC) ────────────────────────────
  if (resourceInputs.length > 0) {
    const deductArgs = { p_player_id: user.id }
    for (const { resource, qty } of resourceInputs) deductArgs[`p_${resource}`] = qty

    const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', deductArgs)
    if (rpcErr) return res.status(500).json({ error: rpcErr.message })
    if (!ok) return res.status(409).json({ error: 'Recursos insuficientes' })
  }

  // ── Validar items (materiales procesados) ───────────────────────────────────
  let itemRows = null
  if (itemInputs.length > 0) {
    const itemIds = itemInputs.map(i => i.item)
    const { data: rows } = await supabase
      .from('player_crafted_items')
      .select('recipe_id, quantity')
      .eq('player_id', user.id)
      .in('recipe_id', itemIds)

    itemRows = Object.fromEntries((rows ?? []).map(r => [r.recipe_id, r.quantity]))

    for (const { item, qty } of itemInputs) {
      if ((itemRows[item] ?? 0) < qty) {
        return res.status(409).json({ error: `Material insuficiente: ${item} (necesitas ${qty})` })
      }
    }
  }

  // Calcular craft_ends_at
  const craftMs = recipe.craft_minutes * 60 * 1000
  const craftEndsAt = new Date(Date.now() + craftMs).toISOString()

  // ── Deducir items + insertar en cola ───────────────────────────────────────
  const promises = []

  for (const { item, qty } of itemInputs) {
    promises.push(
      supabase
        .from('player_crafted_items')
        .update({ quantity: (itemRows[item] ?? 0) - qty })
        .eq('player_id', user.id)
        .eq('recipe_id', item)
        .then(({ error }) => {
          if (error) throw new Error(error.message)
        })
    )
  }

  promises.push(
    supabase
      .from('player_crafting_queue')
      .insert({ player_id: user.id, recipe_id: recipeId, craft_ends_at: craftEndsAt, building_type: recipe.refinery_type ?? null })
      .then(({ error }) => {
        if (error) throw new Error(error.message)
      })
  )

  try {
    await Promise.all(promises)
  } catch (err) {
    return res.status(409).json({ error: err.message })
  }

  return res.status(200).json({ ok: true, craft_ends_at: craftEndsAt })
}
