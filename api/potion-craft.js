import { requireAuth } from './_auth.js'
import { snapshotResources } from './_validate.js'
import { MAX_POTION_STACK } from './_constants.js'
import { LAB_INVENTORY_BASE, LAB_INVENTORY_PER_UPGRADE } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { potionId } = req.body
  if (!potionId) return res.status(400).json({ error: 'potionId requerido' })
  if (typeof potionId !== 'string' || potionId.length > 50) return res.status(400).json({ error: 'potionId inválido' })

  // Obtener receta
  const { data: potion } = await supabase
    .from('potion_catalog')
    .select('*')
    .eq('id', potionId)
    .single()

  if (!potion) return res.status(404).json({ error: 'Poción no encontrada' })

  // Verificar nivel del Laboratorio
  const { data: lab } = await supabase
    .from('buildings')
    .select('level, unlocked')
    .eq('player_id', user.id)
    .eq('type', 'laboratory')
    .single()

  if (!lab || !lab.unlocked) return res.status(403).json({ error: 'El Laboratorio no está desbloqueado' })
  if (lab.level < potion.min_lab_level) return res.status(403).json({ error: `Requiere Laboratorio Nv.${potion.min_lab_level}` })

  // Cargar stock actual, crafts activos del jugador e inventario del laboratorio.
  const [stockRes, potionInvRes, potionCraftRes, resourcesRes] = await Promise.all([
    supabase.from('player_potions').select('quantity').eq('player_id', user.id).eq('potion_id', potionId).maybeSingle(),
    supabase.from('player_potions').select('quantity').eq('player_id', user.id),
    supabase.from('player_potion_crafting').select('potion_id').eq('player_id', user.id),
    supabase.from('resources').select('gold, iron, wood, mana, coal, fiber, arcane_dust, herbs, flowers, fragments, essence, last_collected_at, lab_inventory_upgrades').eq('player_id', user.id).single(),
  ])

  const currentQty      = stockRes.data?.quantity ?? 0
  const activeForPotion = (potionCraftRes.data ?? []).filter(c => c.potion_id === potionId).length

  if (currentQty + activeForPotion >= MAX_POTION_STACK) {
    return res.status(409).json({ error: `Ya tienes el máximo (${MAX_POTION_STACK}) de esta poción` })
  }

  // Verificar capacidad del laboratorio
  const resources = resourcesRes.data
  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const capacity = LAB_INVENTORY_BASE + (resources.lab_inventory_upgrades ?? 0) * LAB_INVENTORY_PER_UPGRADE
  const potionQty = (potionInvRes.data ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0)
  const activeCrafts = potionCraftRes.data?.length ?? 0
  const inventoryUsed = potionQty + activeCrafts

  if (inventoryUsed >= capacity) {
    return res.status(409).json({ error: 'Inventario del laboratorio lleno' })
  }

  const recipeItems = potion.recipe_items ?? []
  const resourceInputs = recipeItems.filter(i => i.resource)
  const itemInputs     = recipeItems.filter(i => i.item)

  const snap = snapshotResources(resources)

  // ── Validar recursos ────────────────────────────────────────────────────────
  const labels = {
    iron: 'Hierro', wood: 'Madera', mana: 'Maná', herbs: 'Hierbas',
    coal: 'Carbón', fiber: 'Fibra', arcane_dust: 'Polvo Arcano', flowers: 'Flores',
    fragments: 'Fragmentos', essence: 'Esencia', gold: 'Oro',
  }

  for (const { resource, qty } of resourceInputs) {
    if ((snap[resource] ?? 0) < qty) {
      return res.status(402).json({ error: `${labels[resource] ?? resource} insuficiente` })
    }
  }

  // ── Validar items procesados ────────────────────────────────────────────────
  let itemRows = null
  if (itemInputs.length > 0) {
    const itemIds = itemInputs.map(i => i.item)
    const { data: rows } = await supabase
      .from('player_crafted_items')
      .select('recipe_id, quantity')
      .eq('player_id', user.id)
      .in('recipe_id', itemIds)

    itemRows = Object.fromEntries((rows ?? []).map(r => [r.recipe_id, r.quantity]))

    const itemLabels = {
      potion_base: 'Base de Poción', steel_ingot: 'Lingote de Acero', plank: 'Tablón',
      mana_crystal: 'Cristal de Maná', herbal_extract: 'Extracto Herbal',
      tempered_steel: 'Acero Templado', composite_wood: 'Madera Compuesta',
      concentrated_mana: 'Maná Concentrado',
    }

    for (const { item, qty } of itemInputs) {
      if ((itemRows[item] ?? 0) < qty) {
        return res.status(402).json({ error: `${itemLabels[item] ?? item} insuficiente (necesitas ${qty})` })
      }
    }
  }

  const craftMs = (potion.craft_minutes ?? 30) * 60 * 1000
  const craftEndsAt = new Date(Date.now() + craftMs).toISOString()

  // ── Deducir recursos (con retry para evitar 409 concurrente) ─────────────
  if (resourceInputs.length > 0) {
    let resourcesOk = false
    for (let attempt = 0; attempt < 8; attempt++) {
      const s = attempt === 0 ? snap : snapshotResources(
        (await supabase.from('resources')
          .select('gold, iron, wood, mana, coal, fiber, arcane_dust, herbs, flowers, fragments, essence, last_collected_at')
          .eq('player_id', user.id).single()).data
      )
      // Re-validar
      for (const { resource, qty } of resourceInputs) {
        if ((s[resource] ?? 0) < qty) return res.status(402).json({ error: 'Recursos insuficientes' })
      }
      const resUpdate = { last_collected_at: s.nowIso }
      for (const { resource, qty } of resourceInputs) {
        resUpdate[resource] = s[resource] - qty
      }
      const { error, count } = await supabase.from('resources')
        .update(resUpdate).eq('player_id', user.id).eq('last_collected_at', s.prevCollectedAt)
      if (error) return res.status(500).json({ error: error.message })
      if (count > 0) { resourcesOk = true; break }
    }
    if (!resourcesOk) return res.status(409).json({ error: 'Recursos desincronizados, reintenta' })
  }

  // ── Deducir items + crear craft ────────────────────────────────────────────
  const promises = []

  for (const { item, qty } of itemInputs) {
    promises.push(
      supabase.from('player_crafted_items')
        .update({ quantity: (itemRows[item] ?? 0) - qty })
        .eq('player_id', user.id)
        .eq('recipe_id', item)
        .then(({ error }) => {
          if (error) throw new Error(error.message)
        })
    )
  }

  promises.push(
    supabase.from('player_potion_crafting')
      .insert({ player_id: user.id, potion_id: potionId, craft_ends_at: craftEndsAt })
      .select('id')
      .single()
      .then(({ error, data }) => {
        if (error) throw new Error(error.message)
        return data
      })
  )

  let craftData
  try {
    const results = await Promise.all(promises)
    craftData = results[results.length - 1]
  } catch (err) {
    return res.status(409).json({ error: err.message })
  }

  return res.status(200).json({ ok: true, id: craftData?.id, craft_ends_at: craftEndsAt })
}
