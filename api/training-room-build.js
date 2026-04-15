import { requireAuth } from './_auth.js'
import { TRAINING_ROOM_STATS } from './_constants.js'

/**
 * POST /api/training-room-build
 * Activa una sala de entrenamiento para el héroe actual.
 * Sin coste de recursos ni tiempo de construcción.
 * Body: { stat, heroId }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { stat, heroId } = req.body
  if (!stat || !TRAINING_ROOM_STATS.includes(stat)) return res.status(400).json({ error: 'Stat inválido' })

  // Comprobar que no existe ya
  const { data: existing } = await supabase
    .from('training_rooms')
    .select('stat')
    .eq('player_id', user.id)
    .eq('stat', stat)
    .maybeSingle()

  if (existing) return res.status(409).json({ error: 'Esta sala ya está activa' })

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('training_rooms')
    .insert({ player_id: user.id, stat, level: 1, built_at: now, building_ends_at: null })

  if (error) return res.status(500).json({ error: error.message })

  // Inicializar fila de entrenamiento del héroe si se pasa heroId
  if (heroId) {
    const { data: hero } = await supabase
      .from('heroes').select('id').eq('id', heroId).eq('player_id', user.id).maybeSingle()
    if (hero) {
      await supabase
        .from('hero_training')
        .upsert(
          { hero_id: heroId, stat, xp_bank: 0, total_gained: 0, last_collected_at: now },
          { onConflict: 'hero_id,stat' }
        )
    }
  }

  return res.status(200).json({ ok: true, stat })
}
