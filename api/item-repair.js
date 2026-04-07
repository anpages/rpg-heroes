import { createClient } from '@supabase/supabase-js'
import { isUUID, safeHours } from './_validate.js'

// Coste base de reparación por rareza (oro + maná por punto de durabilidad restaurado)
const REPAIR_COST = {
  common:    { gold: 2,  mana: 0  },
  uncommon:  { gold: 3,  mana: 1  },
  rare:      { gold: 5,  mana: 3  },
  epic:      { gold: 8,  mana: 6  },
  legendary: { gold: 12, mana: 10 },
}

// Descuento por nivel de herrería: -5% por nivel (máx 50%)
function repairDiscount(forgeLevel) {
  return Math.min(0.5, (forgeLevel - 1) * 0.05)
}

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

  // Obtener item con catálogo
  const { data: item } = await supabase
    .from('inventory_items')
    .select('*, item_catalog(name, rarity, max_durability)')
    .eq('id', itemId)
    .single()

  if (!item) return res.status(404).json({ error: 'Item no encontrado' })

  // Verificar propiedad
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', item.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const catalog = item.item_catalog
  const missing = catalog.max_durability - item.current_durability

  if (missing === 0) return res.status(409).json({ error: 'El item ya está en perfecto estado' })

  // Nivel de la herrería del jugador
  const { data: forge } = await supabase
    .from('buildings')
    .select('level')
    .eq('player_id', user.id)
    .eq('type', 'forge')
    .maybeSingle()

  const forgeLevel = forge?.level ?? 1
  const discount   = repairDiscount(forgeLevel)
  const costs      = REPAIR_COST[catalog.rarity] ?? REPAIR_COST.common

  const goldCost = Math.ceil(missing * costs.gold * (1 - discount))
  const manaCost = Math.ceil(missing * costs.mana * (1 - discount))

  // Verificar recursos (con interpolación idle)
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, mana, gold_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(500).json({ error: 'No se pudieron obtener los recursos' })

  const now = Date.now()
  const hours = safeHours(resources.last_collected_at, now)
  const currentGold = Math.floor(resources.gold + resources.gold_rate * hours)
  const currentMana = Math.floor(resources.mana + resources.mana_rate * hours)

  if (currentGold < goldCost) return res.status(409).json({ error: `Oro insuficiente (necesitas ${goldCost})` })
  if (currentMana < manaCost) return res.status(409).json({ error: `Maná insuficiente (necesitas ${manaCost})` })

  // Reparar
  await supabase
    .from('inventory_items')
    .update({ current_durability: catalog.max_durability })
    .eq('id', itemId)

  await supabase
    .from('resources')
    .update({
      gold: currentGold - goldCost,
      mana: currentMana - manaCost,
      last_collected_at: new Date(now).toISOString(),
    })
    .eq('player_id', user.id)

  return res.status(200).json({ ok: true, goldCost, manaCost })
}
