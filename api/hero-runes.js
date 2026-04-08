import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res, 'GET')
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.query
  if (!heroId || !isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar que el héroe pertenece al usuario
  const { data: hero } = await supabase
    .from('heroes').select('id').eq('id', heroId).eq('player_id', user.id).maybeSingle()
  if (!hero) return res.status(403).json({ error: 'Forbidden' })

  const [catalogRes, inventoryRes] = await Promise.all([
    supabase.from('rune_catalog').select('*').order('id'),
    supabase
      .from('hero_runes')
      .select('rune_id, quantity, rune_catalog(id, name, description, bonuses, recipe_gold, recipe_wood, recipe_mana, min_lab_level)')
      .eq('hero_id', heroId)
      .gt('quantity', 0),
  ])

  if (catalogRes.error) return res.status(500).json({ error: catalogRes.error.message })

  return res.json({
    catalog:   catalogRes.data ?? [],
    inventory: inventoryRes.data ?? [],
  })
}
