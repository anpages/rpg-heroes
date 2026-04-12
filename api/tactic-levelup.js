import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { TACTIC_MAX_LEVEL } from './_constants.js'

/**
 * POST /api/tactic-levelup
 * Sube 1 nivel de una táctica consumiendo un Pergamino Táctico.
 * Body: { heroId, tacticId }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, tacticId } = req.body
  if (!heroId || !isUUID(heroId))     return res.status(400).json({ error: 'heroId inválido' })
  if (!tacticId || !isUUID(tacticId)) return res.status(400).json({ error: 'tacticId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  // Verificar táctica pertenece al héroe
  const { data: tactic } = await supabase
    .from('hero_tactics')
    .select('id, hero_id, tactic_id, level')
    .eq('id', tacticId)
    .eq('hero_id', heroId)
    .maybeSingle()

  if (!tactic) return res.status(404).json({ error: 'Táctica no encontrada' })
  if (tactic.level >= TACTIC_MAX_LEVEL) {
    return res.status(409).json({ error: `La táctica ya está al nivel máximo (${TACTIC_MAX_LEVEL})` })
  }

  // Verificar pergamino táctico
  const { data: scroll } = await supabase
    .from('player_crafted_items')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('recipe_id', 'tactic_scroll')
    .maybeSingle()

  if (!scroll || scroll.quantity <= 0) {
    return res.status(409).json({ error: 'Necesitas un Pergamino Táctico. Craftéalo en el Taller.' })
  }

  // Consumir pergamino + subir nivel
  const [{ error: scrollError }, { error: tacticError }] = await Promise.all([
    supabase
      .from('player_crafted_items')
      .update({ quantity: scroll.quantity - 1 })
      .eq('player_id', user.id)
      .eq('recipe_id', 'tactic_scroll'),
    supabase
      .from('hero_tactics')
      .update({ level: tactic.level + 1 })
      .eq('id', tacticId),
  ])

  if (scrollError) return res.status(500).json({ error: scrollError.message })
  if (tacticError) return res.status(500).json({ error: tacticError.message })

  return res.status(200).json({ ok: true, newLevel: tactic.level + 1 })
}
