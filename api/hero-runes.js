import { requireAuth } from './_auth.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res, 'GET')
  if (!auth) return
  const { user, supabase } = auth

  const [catalogRes, inventoryRes] = await Promise.all([
    supabase.from('rune_catalog').select('*').order('id'),
    supabase
      .from('player_runes')
      .select('rune_id, quantity, rune_catalog(id, name, description, bonuses, recipe_gold, recipe_wood, recipe_mana, min_lab_level)')
      .eq('player_id', user.id)
      .gt('quantity', 0),
  ])

  if (catalogRes.error) return res.status(500).json({ error: catalogRes.error.message })

  return res.json({
    catalog:   catalogRes.data ?? [],
    inventory: inventoryRes.data ?? [],
  })
}
