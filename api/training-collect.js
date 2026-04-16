import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { CLASS_TRAINING_XP_PER_MIN, computeTrainingProgress } from '../src/lib/gameConstants.js'

/**
 * POST /api/training-collect
 * Recolecta XP de clase acumulada. Si stop=true, saca al héroe del estado training.
 * Body: { heroId, stop? }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, stop = false } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('id, status, class_level, class_xp, training_started_at')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero)                      return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'training') return res.status(409).json({ error: 'El héroe no está entrenando' })
  if (!hero.training_started_at)  return res.status(409).json({ error: 'Sin fecha de inicio de entrenamiento' })

  const nowMs      = Date.now()
  const startedMs  = new Date(hero.training_started_at).getTime()
  const elapsedSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000))
  const elapsedMin = Math.floor(elapsedSec / 60)
  const earnedXp   = elapsedMin * CLASS_TRAINING_XP_PER_MIN

  const { classLevel, classXp } = computeTrainingProgress(
    hero.class_level ?? 1,
    hero.class_xp    ?? 0,
    earnedXp,
  )

  const levelUps = classLevel - (hero.class_level ?? 1)

  const { error } = await supabase
    .from('heroes')
    .update({
      class_level:         classLevel,
      class_xp:            classXp,
      training_started_at: stop ? null : new Date(nowMs).toISOString(),
      ...(stop ? { status: 'idle' } : {}),
    })
    .eq('id', heroId)
    .eq('player_id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true, classLevel, classXp, levelUps, elapsedMin, elapsedSec, earnedXp })
}
