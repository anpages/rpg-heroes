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
  // Todo se ejecuta en paralelo porque no dependen entre sí.
  const [stockRes, potionInvRes, runeInvRes, potionCraftRes, runeCraftRes, resourcesRes] = await Promise.all([
    supabase.from('player_potions').select('quantity').eq('player_id', user.id).eq('potion_id', potionId).maybeSingle(),
    supabase.from('player_potions').select('quantity').eq('player_id', user.id),
    supabase.from('player_runes').select('quantity').eq('player_id', user.id),
    supabase.from('player_potion_crafting').select('potion_id').eq('player_id', user.id),
    supabase.from('player_rune_crafting').select('rune_id').eq('player_id', user.id),
    supabase.from('resources').select('gold, iron, wood, mana, fragments, essence, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at, lab_inventory_upgrades').eq('player_id', user.id).single(),
  ])

  const currentQty      = stockRes.data?.quantity ?? 0
  const activeForPotion = (potionCraftRes.data ?? []).filter(c => c.potion_id === potionId).length

  // Bloquear si el stock + crafts activos de esta receta ya llega al máximo:
  // de lo contrario el jugador podría iniciar crafts que nunca podría recoger.
  if (currentQty + activeForPotion >= MAX_POTION_STACK) {
    return res.status(409).json({ error: `Ya tienes el máximo (${MAX_POTION_STACK}) de esta poción` })
  }

  // Verificar capacidad del laboratorio: items + crafts activos cuentan como slots.
  const resources = resourcesRes.data
  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const capacity = LAB_INVENTORY_BASE + (resources.lab_inventory_upgrades ?? 0) * LAB_INVENTORY_PER_UPGRADE
  const potionQty = (potionInvRes.data ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0)
  const runeQty   = (runeInvRes.data   ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0)
  const activeCrafts = (potionCraftRes.data?.length ?? 0) + (runeCraftRes.data?.length ?? 0)
  const inventoryUsed = potionQty + runeQty + activeCrafts

  if (inventoryUsed >= capacity) {
    return res.status(409).json({ error: 'Inventario del laboratorio lleno' })
  }

  const snap = snapshotResources(resources)

  if (snap.gold      < potion.recipe_gold)      return res.status(402).json({ error: 'Oro insuficiente' })
  if (snap.wood      < potion.recipe_wood)      return res.status(402).json({ error: 'Madera insuficiente' })
  if (snap.mana      < potion.recipe_mana)      return res.status(402).json({ error: 'Maná insuficiente' })
  if (snap.fragments < (potion.recipe_fragments ?? 0)) return res.status(402).json({ error: 'Fragmentos insuficientes' })
  if (snap.essence   < (potion.recipe_essence   ?? 0)) return res.status(402).json({ error: 'Esencia insuficiente' })

  const craftMs = (potion.craft_minutes ?? 30) * 60 * 1000
  const craftEndsAt = new Date(Date.now() + craftMs).toISOString()

  const [resourcesResult, craftResult] = await Promise.all([
    supabase.from('resources').update({
      gold:      snap.gold      - potion.recipe_gold,
      iron:      snap.iron,
      wood:      snap.wood      - potion.recipe_wood,
      mana:      snap.mana      - potion.recipe_mana,
      fragments: snap.fragments - (potion.recipe_fragments ?? 0),
      essence:   snap.essence   - (potion.recipe_essence   ?? 0),
      last_collected_at: snap.nowIso,
    }).eq('player_id', user.id).eq('last_collected_at', snap.prevCollectedAt),

    supabase.from('player_potion_crafting')
      .insert({ player_id: user.id, potion_id: potionId, craft_ends_at: craftEndsAt })
      .select('id')
      .single(),
  ])

  if (resourcesResult.error) return res.status(500).json({ error: resourcesResult.error.message })
  if (craftResult.error)    return res.status(500).json({ error: craftResult.error.message })

  return res.status(200).json({ ok: true, id: craftResult.data?.id, craft_ends_at: craftEndsAt })
}
