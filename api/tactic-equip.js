import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { TACTIC_SWAP_COST } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, tacticId, slotIndex } = req.body
  if (!heroId || !tacticId) return res.status(400).json({ error: 'heroId y tacticId requeridos' })
  if (!isUUID(heroId))      return res.status(400).json({ error: 'heroId invalido' })
  if (!isUUID(tacticId))    return res.status(400).json({ error: 'tacticId invalido' })

  const targetSlot = slotIndex === null || slotIndex === undefined ? null : Number(slotIndex)
  if (targetSlot !== null && (targetSlot < 0 || targetSlot > 4 || !Number.isInteger(targetSlot))) {
    return res.status(400).json({ error: 'slotIndex debe ser 0-4 o null' })
  }

  const { data: result, error } = await supabase.rpc('equip_tactic', {
    p_hero_id:    heroId,
    p_tactic_id:  tacticId,
    p_slot_index: targetSlot,
    p_user_id:    user.id,
    p_swap_cost:  TACTIC_SWAP_COST,
  })

  if (error) return res.status(500).json({ error: error.message })
  if (result?.error) return res.status(409).json({ error: result.error })

  return res.status(200).json(result)
}
