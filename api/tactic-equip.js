import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { TACTIC_SWAP_COST } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, tacticId, slotIndex } = req.body
  if (!heroId || !tacticId) return res.status(400).json({ error: 'heroId y tacticId requeridos' })
  if (!isUUID(heroId))      return res.status(400).json({ error: 'heroId invalido' })
  if (!isUUID(tacticId))    return res.status(400).json({ error: 'tacticId invalido' })

  // slotIndex null = desequipar, 0-4 = equipar en slot
  const targetSlot = slotIndex === null || slotIndex === undefined ? null : Number(slotIndex)
  if (targetSlot !== null && (targetSlot < 0 || targetSlot > 4 || !Number.isInteger(targetSlot))) {
    return res.status(400).json({ error: 'slotIndex debe ser 0-4 o null' })
  }

  // Verificar heroe
  const { data: hero } = await supabase
    .from('heroes').select('id, player_id, status, class').eq('id', heroId).eq('player_id', user.id).single()
  if (!hero) return res.status(403).json({ error: 'No autorizado' })
  if (hero.status === 'exploring') return res.status(409).json({ error: 'El heroe esta en una expedicion' })

  // Verificar que el jugador tiene esta tactica en el heroe
  const { data: heroTactic } = await supabase
    .from('hero_tactics')
    .select('id, slot_index, tactic_catalog(required_class)')
    .eq('hero_id', heroId)
    .eq('tactic_id', tacticId)
    .maybeSingle()

  if (!heroTactic) return res.status(404).json({ error: 'No tienes esta tactica en este heroe' })

  // Validar restriccion de clase
  const reqClass = heroTactic.tactic_catalog?.required_class
  if (reqClass && reqClass !== hero.class) {
    return res.status(409).json({ error: 'Esta tactica es exclusiva de otra clase' })
  }

  // Si ya esta en el slot destino, no hacer nada
  if (heroTactic.slot_index === targetSlot) {
    return res.status(200).json({ ok: true, changed: false })
  }

  // Cobrar gold si es un cambio (no si es la primera vez que equipa en un slot vacio)
  const isSwap = heroTactic.slot_index !== null && targetSlot !== null
  if (isSwap && TACTIC_SWAP_COST > 0) {
    const { data: resources } = await supabase
      .from('resources').select('*').eq('player_id', user.id).single()
    const snap = snapshotResources(resources)
    if (snap.gold < TACTIC_SWAP_COST) {
      return res.status(409).json({ error: `Necesitas ${TACTIC_SWAP_COST} oro para cambiar la tactica de slot` })
    }
    const { error: resErr, count } = await supabase
      .from('resources')
      .update({ gold: snap.gold - TACTIC_SWAP_COST, iron: snap.iron, wood: snap.wood, mana: snap.mana, last_collected_at: snap.nowIso })
      .eq('player_id', user.id)
      .eq('last_collected_at', snap.prevCollectedAt)
    if (resErr || count === 0) return res.status(409).json({ error: 'Recursos desincronizados, reintenta' })
  }

  // Si el slot destino ya tiene otra tactica, desequiparla
  if (targetSlot !== null) {
    const { data: occupant } = await supabase
      .from('hero_tactics')
      .select('id')
      .eq('hero_id', heroId)
      .eq('slot_index', targetSlot)
      .neq('tactic_id', tacticId)
      .maybeSingle()

    if (occupant) {
      await supabase
        .from('hero_tactics')
        .update({ slot_index: null })
        .eq('id', occupant.id)
    }
  }

  // Actualizar slot de la tactica
  const { error: updateErr } = await supabase
    .from('hero_tactics')
    .update({ slot_index: targetSlot })
    .eq('id', heroTactic.id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  return res.status(200).json({ ok: true, changed: true, goldSpent: isSwap ? TACTIC_SWAP_COST : 0 })
}
