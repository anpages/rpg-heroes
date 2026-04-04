import { createClient } from '@supabase/supabase-js'

const INVENTORY_BASE_LIMIT = 20
const INVENTORY_PER_WORKSHOP_LEVEL = 5

async function getInventoryLimit(supabase, playerId) {
  const { data: workshop } = await supabase
    .from('buildings')
    .select('level')
    .eq('player_id', playerId)
    .eq('type', 'workshop')
    .maybeSingle()
  return INVENTORY_BASE_LIMIT + ((workshop?.level ?? 1) - 1) * INVENTORY_PER_WORKSHOP_LEVEL
}

async function getBagCount(supabase, heroId) {
  const { count } = await supabase
    .from('inventory_items')
    .select('id', { count: 'exact', head: true })
    .eq('hero_id', heroId)
    .is('equipped_slot', null)
  return count ?? 0
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

  const { itemId, equip } = req.body
  if (!itemId || equip === undefined) return res.status(400).json({ error: 'itemId y equip requeridos' })

  // Obtener item con datos del catálogo
  const { data: item } = await supabase
    .from('inventory_items')
    .select('*, item_catalog(*)')
    .eq('id', itemId)
    .single()

  if (!item) return res.status(404).json({ error: 'Item no encontrado' })

  // Verificar que el item pertenece al héroe del usuario
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', item.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const heroId = hero.id
  const catalog = item.item_catalog
  const catalogSlot = catalog.slot

  // ── DESEQUIPAR ────────────────────────────────────────────────────────────
  if (!equip) {
    if (!item.equipped_slot) return res.status(409).json({ error: 'El item no está equipado' })

    const bagCount = await getBagCount(supabase, heroId)
    const limit = await getInventoryLimit(supabase, user.id)
    if (bagCount >= limit) return res.status(409).json({ error: 'Mochila llena' })

    await supabase
      .from('inventory_items')
      .update({ equipped_slot: null })
      .eq('id', itemId)

    // Si era un arma a dos manos, liberar también el off_hand
    if (catalog.is_two_handed) {
      await supabase
        .from('inventory_items')
        .update({ equipped_slot: null })
        .eq('hero_id', heroId)
        .eq('equipped_slot', 'off_hand_2h_blocker')
    }

    return res.status(200).json({ ok: true })
  }

  // ── EQUIPAR ───────────────────────────────────────────────────────────────
  if (item.equipped_slot) return res.status(409).json({ error: 'El item ya está equipado' })

  // Para accesorios: buscar el primer slot libre entre accessory y accessory_2
  let targetSlot = catalogSlot
  if (catalogSlot === 'accessory') {
    const { data: occupied } = await supabase
      .from('inventory_items')
      .select('equipped_slot')
      .eq('hero_id', heroId)
      .in('equipped_slot', ['accessory', 'accessory_2'])
    const occupiedSlots = new Set(occupied?.map(i => i.equipped_slot) ?? [])
    if (!occupiedSlots.has('accessory'))       targetSlot = 'accessory'
    else if (!occupiedSlots.has('accessory_2')) targetSlot = 'accessory_2'
    else                                        targetSlot = 'accessory' // reemplaza el primero
  }

  // Items que serán desplazados a la mochila
  const slotsToFree = [targetSlot]
  if (catalog.is_two_handed) slotsToFree.push('off_hand')

  const { data: toUnequip } = await supabase
    .from('inventory_items')
    .select('id')
    .eq('hero_id', heroId)
    .in('equipped_slot', slotsToFree)

  // Calcular cambio neto en mochila: +unequipped -1 (el item que se equipa)
  const bagDelta = (toUnequip?.length ?? 0) - 1
  if (bagDelta > 0) {
    const bagCount = await getBagCount(supabase, heroId)
    const limit = await getInventoryLimit(supabase, user.id)
    if (bagCount + bagDelta > limit) return res.status(409).json({ error: 'Mochila llena para hacer el cambio' })
  }

  // Desequipar los items del slot objetivo
  if (toUnequip?.length) {
    await supabase
      .from('inventory_items')
      .update({ equipped_slot: null })
      .in('id', toUnequip.map(i => i.id))
  }

  // Equipar el nuevo item
  await supabase
    .from('inventory_items')
    .update({ equipped_slot: targetSlot })
    .eq('id', itemId)

  return res.status(200).json({ ok: true })
}
