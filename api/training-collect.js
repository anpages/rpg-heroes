import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { xpRateForLevel, xpThreshold } from '../src/lib/gameConstants.js'

/**
 * POST /api/training-collect
 * Recolecta XP de una sala y aplica los puntos directamente al héroe.
 * Body: { heroId, stat }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, stat } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })
  if (!stat) return res.status(400).json({ error: 'stat requerido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, active_effects')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  // Obtener sala (debe estar construida y sin mejora en curso)
  const { data: room } = await supabase
    .from('training_rooms')
    .select('stat, level, built_at, building_ends_at')
    .eq('player_id', user.id)
    .eq('stat', stat)
    .maybeSingle()

  const now = new Date()

  if (!room || !room.built_at || (room.building_ends_at && new Date(room.building_ends_at) > now)) {
    return res.status(409).json({ error: 'Sala no disponible para recolectar' })
  }

  // Obtener o crear fila de entrenamiento
  let { data: row } = await supabase
    .from('hero_training')
    .select('*')
    .eq('hero_id', heroId)
    .eq('stat', stat)
    .maybeSingle()

  if (!row) {
    const { data: inserted } = await supabase
      .from('hero_training')
      .insert({ hero_id: heroId, stat, xp_bank: 0, total_gained: 0, last_collected_at: room.built_at })
      .select()
      .single()
    row = inserted
  }

  const trainingBoost = hero.active_effects?.training_boost ?? 0
  const rate = xpRateForLevel(room.level)
  const thr  = xpThreshold(row.total_gained)

  const lastCollected = new Date(Math.max(
    new Date(row.last_collected_at).getTime(),
    new Date(room.built_at).getTime(),
  ))

  const hoursToThreshold = Math.max(0, (thr - row.xp_bank) / rate)
  const hoursElapsed     = (now - lastCollected) / 3_600_000
  const effectiveHours   = Math.min(hoursElapsed, hoursToThreshold)

  let pendingXp   = row.xp_bank + effectiveHours * rate * (1 + trainingBoost)
  let totalGained = row.total_gained
  let statGains   = 0

  while (pendingXp >= xpThreshold(totalGained)) {
    pendingXp   -= xpThreshold(totalGained)
    totalGained += 1
    statGains   += 1
  }

  // Actualizar XP bank
  await supabase
    .from('hero_training')
    .upsert(
      { hero_id: heroId, stat, xp_bank: pendingXp, total_gained: totalGained, last_collected_at: now.toISOString() },
      { onConflict: 'hero_id,stat' }
    )

  // Aplicar puntos directamente al héroe
  if (statGains > 0) {
    await supabase.rpc('apply_training_gains', {
      p_hero_id: heroId,
      p_gains: { [stat]: statGains },
    })

    // Consumir training_boost si se usó
    if (trainingBoost) {
      const newEffects = { ...(hero.active_effects ?? {}) }
      delete newEffects.training_boost
      await supabase.from('heroes').update({ active_effects: newEffects }).eq('id', heroId)
    }
  }

  return res.status(200).json({ ok: true, gained: statGains })
}
