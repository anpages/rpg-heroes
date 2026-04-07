import { createClient } from '@supabase/supabase-js'
import { isUUID } from './_validate.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

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
