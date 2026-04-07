import { createClient } from '@supabase/supabase-js'
import { isUUID, safeHours } from './_validate.js'
import { DISMANTLE_MANA_TABLE as DISMANTLE_MANA } from './_constants.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { itemId } = req.body
  if (!itemId) return res.status(400).json({ error: 'itemId requerido' })
  if (!isUUID(itemId)) return res.status(400).json({ error: 'itemId inválido' })

  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, hero_id, equipped_slot, item_catalog(rarity, tier)')
    .eq('id', itemId)
    .single()

  if (!item) return res.status(404).json({ error: 'Item no encontrado' })
  if (item.equipped_slot) return res.status(409).json({ error: 'No puedes desmantelar un item equipado' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('player_id')
    .eq('id', item.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // Calcular maná recuperado
  const baseRate = DISMANTLE_MANA[item.item_catalog.rarity] ?? DISMANTLE_MANA.common
  const manaGained = baseRate * (item.item_catalog.tier ?? 1)

  // Obtener recursos actuales con interpolación
  const { data: resources } = await supabase
    .from('resources')
    .select('iron, wood, mana, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const now = Date.now()
  const hours = safeHours(resources.last_collected_at, now)
  const snapshotIron = Math.floor(resources.iron + resources.iron_rate * hours)
  const snapshotWood = Math.floor(resources.wood + resources.wood_rate * hours)
  const currentMana = Math.floor(resources.mana + resources.mana_rate * hours)

  // Desmantelar item y añadir maná
  const [deleteResult, updateResult] = await Promise.all([
    supabase.from('inventory_items').delete().eq('id', itemId),
    supabase.from('resources').update({
      iron: snapshotIron,
      wood: snapshotWood,
      mana: currentMana + manaGained,
      last_collected_at: new Date(now).toISOString(),
    }).eq('player_id', user.id),
  ])

  if (deleteResult.error) return res.status(500).json({ error: deleteResult.error.message })
  if (updateResult.error) return res.status(500).json({ error: updateResult.error.message })

  return res.status(200).json({ ok: true, mana: manaGained })
}
