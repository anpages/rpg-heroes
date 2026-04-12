import { requireAuth } from './_auth.js'
import { snapshotResources } from './_validate.js'
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

  // ── Validar y deducir recursos ──────────────────────────────────────────────
  let snap = null
  if (resourceInputs.length > 0) {
    const { data: resources } = await supabase
      .from('resources')
      .select('gold, iron, wood, mana, coal, fiber, arcane_dust, herbs, flowers, fragments, essence, last_collected_at')
      .eq('player_id', user.id)
      .single()

    if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

    snap = snapshotResources(resources)
    const labels = {
      iron: 'Hierro', wood: 'Madera', mana: 'Maná', herbs: 'Hierbas',
      coal: 'Carbón', fiber: 'Fibra', arcane_dust: 'Polvo Arcano', flowers: 'Flores',
      fragments: 'Fragmentos', essence: 'Esencia',
    }

    for (const { resource, qty } of resourceInputs) {
      if ((snap[resource] ?? 0) < qty) {
        return res.status(409).json({ error: `${labels[resource] ?? resource} insuficiente (necesitas ${qty})` })
      }
    }
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
  const nowMs = snap?.nowMs ?? Date.now()
  const craftEndsAt = new Date(nowMs + craftMs).toISOString()

  // ── Deducir recursos (con retry para evitar 409 concurrente) ─────────────
  if (resourceInputs.length > 0) {
    let resourcesOk = false
    for (let attempt = 0; attempt < 8; attempt++) {
      // Re-leer en cada intento para tener last_collected_at fresco
      const { data: freshRes } = attempt === 0 ? { data: null } : await supabase
        .from('resources')
        .select('gold, iron, wood, mana, coal, fiber, arcane_dust, herbs, flowers, fragments, essence, last_collected_at')
        .eq('player_id', user.id)
        .single()

      const s = attempt === 0 ? snap : snapshotResources(freshRes)
      // Re-validar que aún alcanza
      for (const { resource, qty } of resourceInputs) {
        if ((s[resource] ?? 0) < qty) {
          return res.status(409).json({ error: 'Recursos insuficientes (cambiaron), reintenta' })
        }
      }

      const resUpdate = { last_collected_at: s.nowIso }
      for (const { resource, qty } of resourceInputs) {
        resUpdate[resource] = s[resource] - qty
      }
      const { error, count } = await supabase
        .from('resources')
        .update(resUpdate)
        .eq('player_id', user.id)
        .eq('last_collected_at', s.prevCollectedAt)

      if (error) return res.status(500).json({ error: error.message })
      if (count > 0) { resourcesOk = true; break }
    }
    if (!resourcesOk) return res.status(409).json({ error: 'Recursos desincronizados, reintenta' })
  }

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
