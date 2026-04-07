import { createClient } from '@supabase/supabase-js'
import { isUUID } from './_validate.js'
import { CARD_SLOT_COUNT } from './_constants.js'

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

  const { cardId, slotIndex } = req.body
  if (!cardId)           return res.status(400).json({ error: 'cardId requerido' })
  if (!isUUID(cardId))   return res.status(400).json({ error: 'cardId inválido' })

  // slotIndex: null = desequipar, 0-4 = equipar en slot
  const unequipping = slotIndex === null || slotIndex === undefined
  if (!unequipping && (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex >= CARD_SLOT_COUNT || !Number.isInteger(slotIndex))) {
    return res.status(400).json({ error: `slotIndex debe ser null o un entero entre 0 y ${CARD_SLOT_COUNT - 1}` })
  }

  const { data: heroCard } = await supabase
    .from('hero_cards')
    .select('id, hero_id, slot_index, rank')
    .eq('id', cardId)
    .single()

  if (!heroCard) return res.status(404).json({ error: 'Carta no encontrada' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', heroCard.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // ── DESEQUIPAR ────────────────────────────────────────────────────────────
  if (unequipping) {
    if (heroCard.slot_index === null) return res.status(409).json({ error: 'La carta no está equipada' })
    await supabase.from('hero_cards').update({ slot_index: null }).eq('id', cardId)
    return res.status(200).json({ ok: true })
  }

  // ── EQUIPAR ───────────────────────────────────────────────────────────────
  if (heroCard.slot_index !== null) return res.status(409).json({ error: 'La carta ya está equipada' })

  // Verificar que el slot destino está libre
  const { data: slotOccupant } = await supabase
    .from('hero_cards')
    .select('id')
    .eq('hero_id', hero.id)
    .eq('slot_index', slotIndex)
    .maybeSingle()

  if (slotOccupant) {
    return res.status(409).json({ error: `El slot ${slotIndex + 1} ya está ocupado` })
  }

  // Verificar que no se supera el máximo de slots
  const { count } = await supabase
    .from('hero_cards')
    .select('id', { count: 'exact', head: true })
    .eq('hero_id', hero.id)
    .not('slot_index', 'is', null)

  if ((count ?? 0) >= CARD_SLOT_COUNT) {
    return res.status(409).json({ error: `Slots llenos (máx ${CARD_SLOT_COUNT}). Desequipa una carta primero.` })
  }

  await supabase.from('hero_cards').update({ slot_index: slotIndex }).eq('id', cardId)
  return res.status(200).json({ ok: true })
}
