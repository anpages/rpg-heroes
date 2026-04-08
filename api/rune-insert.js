import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { BASE_RUNE_SLOTS } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, inventoryItemId, slotIndex, runeId } = req.body
  if (!heroId || !isUUID(heroId))               return res.status(400).json({ error: 'heroId inválido' })
  if (!inventoryItemId || !isUUID(inventoryItemId)) return res.status(400).json({ error: 'inventoryItemId inválido' })
  if (slotIndex !== 0 && slotIndex !== 1 && slotIndex !== 2) return res.status(400).json({ error: 'slotIndex debe ser 0, 1 o 2' })
  if (!runeId) return res.status(400).json({ error: 'runeId requerido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes').select('id').eq('id', heroId).eq('player_id', user.id).maybeSingle()
  if (!hero) return res.status(403).json({ error: 'Forbidden' })

  // Slots disponibles: base fija + bonus de investigación
  const { getResearchBonuses } = await import('./_research.js')
  const rb       = await getResearchBonuses(supabase, user.id)
  const maxSlots = BASE_RUNE_SLOTS + rb.rune_slot_bonus

  if (slotIndex >= maxSlots) {
    return res.status(400).json({ error: 'Slot de runa no disponible' })
  }

  // Verificar que el ítem pertenece al héroe y está equipado
  const { data: item } = await supabase
    .from('inventory_items').select('id, equipped_slot')
    .eq('id', inventoryItemId).eq('hero_id', heroId).maybeSingle()
  if (!item) return res.status(404).json({ error: 'Ítem no encontrado' })
  if (!item.equipped_slot) return res.status(400).json({ error: 'El ítem debe estar equipado para recibir una runa' })

  // Verificar que el slot está libre
  const { data: occupied } = await supabase
    .from('item_runes').select('id')
    .eq('inventory_item_id', inventoryItemId).eq('slot_index', slotIndex).maybeSingle()
  if (occupied) return res.status(400).json({ error: 'Ese slot ya tiene una runa incrustada' })

  // Verificar inventario de runas del héroe
  const { data: heroRune } = await supabase
    .from('hero_runes').select('id, quantity')
    .eq('hero_id', heroId).eq('rune_id', runeId).maybeSingle()
  if (!heroRune || heroRune.quantity < 1) return res.status(400).json({ error: 'No tienes esa runa en el inventario' })

  // Decrementar inventario
  const { error: dErr } = await supabase
    .from('hero_runes').update({ quantity: heroRune.quantity - 1 }).eq('id', heroRune.id)
  if (dErr) return res.status(500).json({ error: dErr.message })

  // Incrustar runa
  const { error: iErr } = await supabase
    .from('item_runes').insert({ inventory_item_id: inventoryItemId, slot_index: slotIndex, rune_id: runeId })

  if (iErr) {
    await supabase.from('hero_runes').update({ quantity: heroRune.quantity }).eq('id', heroRune.id)
    return res.status(500).json({ error: iErr.message })
  }

  return res.json({ ok: true })
}
