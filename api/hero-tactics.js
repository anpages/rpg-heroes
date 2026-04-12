import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const heroId = req.query?.heroId ?? req.body?.heroId
  if (!heroId)       return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId invalido' })

  // Verificar que el heroe pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes').select('id').eq('id', heroId).eq('player_id', user.id).single()
  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  const [inventoryRes, catalogRes] = await Promise.all([
    supabase
      .from('hero_tactics')
      .select('*, tactic_catalog(*)')
      .eq('hero_id', heroId)
      .order('slot_index', { ascending: true, nullsFirst: false }),
    supabase
      .from('tactic_catalog')
      .select('*')
      .order('category')
      .order('rarity'),
  ])

  return res.status(200).json({
    tactics: inventoryRes.data ?? [],
    catalog: catalogRes.data ?? [],
  })
}
