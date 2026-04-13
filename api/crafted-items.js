import { requireAuth } from './_auth.js'

/**
 * GET /api/crafted-items
 * Devuelve el inventario de items crafteados + cola de crafteo activa + catálogo completo.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res, 'GET')
  if (!auth) return
  const { user, supabase } = auth

  const [catalogRes, itemsRes, queueRes, refiningRes] = await Promise.all([
    supabase.from('crafting_catalog').select('*').order('min_lab_level').order('category'),
    supabase.from('player_crafted_items').select('recipe_id, quantity').eq('player_id', user.id),
    supabase.from('player_crafting_queue').select('id, recipe_id, craft_ends_at, building_type').eq('player_id', user.id).order('craft_ends_at'),
    supabase.from('player_refining_slots').select('id, building_type, recipe_id, quantity, craft_started_at, unit_duration_ms').eq('player_id', user.id),
  ])

  if (catalogRes.error) return res.status(500).json({ error: catalogRes.error.message })

  // Combinar inventario en un mapa recipe_id → quantity
  const inventory = {}
  for (const row of (itemsRes.data ?? [])) {
    inventory[row.recipe_id] = row.quantity
  }

  return res.status(200).json({
    catalog: catalogRes.data ?? [],
    inventory,
    queue: queueRes.data ?? [],
    refiningSlots: refiningRes.data ?? [],
  })
}
