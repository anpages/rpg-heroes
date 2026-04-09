import { createClient } from '@supabase/supabase-js'
import { isUUID } from './_validate.js'
import { INVENTORY_BASE_LIMIT } from './_constants.js'

function getInventoryLimit() {
  return INVENTORY_BASE_LIMIT
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

  const token = req.headers.authorization?.replace(/^bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const { itemId, equip } = req.body
  if (!itemId || equip === undefined) return res.status(400).json({ error: 'itemId y equip requeridos' })
  if (!isUUID(itemId)) return res.status(400).json({ error: 'itemId inválido' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Stage 1: auth + item fetch en paralelo
  const [authRes, itemRes] = await Promise.all([
    supabase.auth.getUser(token),
    supabase
      .from('inventory_items')
      .select('*, item_catalog(*), hero:heroes!hero_id(id, player_id, status, class)')
      .eq('id', itemId)
      .single(),
  ])

  const { data: { user }, error: authError } = authRes
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const item = itemRes.data
  if (!item) return res.status(404).json({ error: 'Item no encontrado' })
  if (item.hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (item.hero.status === 'exploring') return res.status(409).json({ error: 'El héroe está en una expedición' })
  if (item.item_catalog.required_class && item.item_catalog.required_class !== item.hero.class) {
    return res.status(409).json({ error: 'Este item es exclusivo de otra clase' })
  }

  const heroId  = item.hero.id
  const catalog = item.item_catalog

  // ── DESEQUIPAR ────────────────────────────────────────────────────────────
  if (!equip) {
    if (!item.equipped_slot) return res.status(409).json({ error: 'El item no está equipado' })

    // Stage 2: bag count + inventory limit en paralelo
    const [bagCount, limit] = await Promise.all([
      getBagCount(supabase, heroId),
      getInventoryLimit(),
    ])
    if (bagCount >= limit) return res.status(409).json({ error: 'Mochila llena' })

    await supabase
      .from('inventory_items')
      .update({ equipped_slot: null })
      .eq('id', itemId)

    return res.status(200).json({ ok: true })
  }

  // ── EQUIPAR ───────────────────────────────────────────────────────────────
  if (item.equipped_slot) return res.status(409).json({ error: 'El item ya está equipado' })
  if (item.current_durability <= 0) return res.status(409).json({ error: 'El item está roto. Repáralo antes de equiparlo.' })

  let targetSlot   = catalog.slot
  const slotsToFree = [targetSlot]
  if (catalog.is_two_handed) slotsToFree.push('off_hand')

  // Para accesorios: resolver slot libre
  if (catalog.slot === 'accessory') {
    const { data: occupied } = await supabase
      .from('inventory_items')
      .select('equipped_slot')
      .eq('hero_id', heroId)
      .in('equipped_slot', ['accessory', 'accessory_2'])
    const occupiedSet = new Set(occupied?.map(i => i.equipped_slot) ?? [])
    targetSlot      = !occupiedSet.has('accessory') ? 'accessory' : !occupiedSet.has('accessory_2') ? 'accessory_2' : 'accessory'
    slotsToFree[0] = targetSlot
  }

  // Stage 2: buscar items desplazados
  const { data: toUnequip } = await supabase
    .from('inventory_items')
    .select('id')
    .eq('hero_id', heroId)
    .in('equipped_slot', slotsToFree)

  const bagDelta = (toUnequip?.length ?? 0) - 1
  if (bagDelta > 0) {
    const [bagCount, limit] = await Promise.all([
      getBagCount(supabase, heroId),
      getInventoryLimit(),
    ])
    if (bagCount + bagDelta > limit) return res.status(409).json({ error: 'Mochila llena para hacer el cambio' })
  }

  // Stage 3: desequipar desplazados + equipar nuevo en paralelo
  await Promise.all([
    toUnequip?.length
      ? supabase.from('inventory_items').update({ equipped_slot: null }).in('id', toUnequip.map(i => i.id))
      : Promise.resolve(),
    supabase.from('inventory_items').update({ equipped_slot: targetSlot }).eq('id', itemId),
  ])

  return res.status(200).json({ ok: true })
}
