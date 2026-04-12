import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'

/**
 * POST /api/training-tonic-use
 * Usa un Tónico de Entrenamiento (crafted item) para activar training_boost
 * en un héroe. La próxima recolección de entrenamiento duplica la XP ganada.
 * Body: { heroId }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId || !isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, active_effects')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  // Ya tiene boost activo
  if (hero.active_effects?.training_boost) {
    return res.status(409).json({ error: 'Este héroe ya tiene un tónico activo' })
  }

  // Verificar tónico en inventario
  const { data: tonic } = await supabase
    .from('player_crafted_items')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('recipe_id', 'training_tonic')
    .maybeSingle()

  if (!tonic || tonic.quantity <= 0) {
    return res.status(409).json({ error: 'Necesitas un Tónico de Entrenamiento. Craftéalo en el Taller.' })
  }

  // Consumir tónico + activar boost
  const newEffects = { ...(hero.active_effects ?? {}), training_boost: 1 }

  const [{ error: tonicErr }, { error: heroErr }] = await Promise.all([
    supabase
      .from('player_crafted_items')
      .update({ quantity: tonic.quantity - 1 })
      .eq('player_id', user.id)
      .eq('recipe_id', 'training_tonic'),
    supabase
      .from('heroes')
      .update({ active_effects: newEffects })
      .eq('id', heroId),
  ])

  if (tonicErr) return res.status(500).json({ error: tonicErr.message })
  if (heroErr) return res.status(500).json({ error: heroErr.message })

  return res.status(200).json({ ok: true })
}
