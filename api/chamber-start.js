import { requireAuth } from './_auth.js'
import { interpolateHP } from './_hp.js'
import { isUUID } from './_validate.js'
import {
  CHAMBER_TYPES,
  chamberDifficultyForLevel,
  chamberHpCost,
} from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, chamberType } = req.body
  if (!heroId)      return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })
  if (!chamberType || !CHAMBER_TYPES[chamberType]) {
    return res.status(400).json({ error: 'chamberType inválido' })
  }

  // Cargar héroe. Cámaras y expediciones son mutuamente excluyentes:
  // ambas bloquean el héroe poniéndolo en status='exploring', y el chequeo de
  // status !== 'idle' actúa como lock compartido entre ambos sistemas.
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, level, status, player_id, current_hp, max_hp, hp_last_updated_at, status_ends_at, class, active_effects')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') {
    return res.status(409).json({ error: 'El héroe ya está ocupado' })
  }

  // Coste de HP — escalado por tipo de cámara (más larga = más caro)
  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs)
  const hpCost = chamberHpCost(chamberType, hero.max_hp)
  if (currentHp <= hpCost) {
    return res.status(409).json({
      error: `HP insuficiente. Esta cámara cuesta ${hpCost} HP y tienes ${currentHp}.`,
      code: 'LOW_HP',
    })
  }
  const hpAfter = Math.max(1, currentHp - hpCost)

  // Sortear duración entre min y max del tipo elegido
  const cfg = CHAMBER_TYPES[chamberType]
  const baseDurationMin = cfg.minMinutes + Math.random() * (cfg.maxMinutes - cfg.minMinutes)
  // Poción de tiempo activa: reduce duración por effect_value. Se aplica
  // sobre el mismo efecto que las expediciones; misma constante reutilizada.
  const timeReduction = hero.active_effects?.time_reduction ?? 0
  const durationMin = Math.max(0.1, baseDurationMin * (1 - timeReduction))
  const endsAt = new Date(nowMs + Math.round(durationMin * 60_000))

  const difficulty = chamberDifficultyForLevel(hero.level)

  // Consumir time_reduction al iniciar. Otros boosts (loot_boost) se consumen
  // en chamber-collect porque afectan al roll del cofre.
  const effectsAfter = { ...(hero.active_effects ?? {}) }
  if (timeReduction) delete effectsAfter.time_reduction

  // Reclamar atómicamente el héroe (mismo patrón que expedition-start):
  // pasa a 'exploring' solo si sigue en 'idle'. Esto evita la condición de
  // carrera donde dos peticiones simultáneas (cámara + expedición, o dos
  // cámaras) pasen ambas el chequeo de status.
  const { data: claimed, error: claimError } = await supabase
    .from('heroes')
    .update({
      status:             'exploring',
      current_hp:         hpAfter,
      hp_last_updated_at: new Date(nowMs).toISOString(),
      status_ends_at:     endsAt.toISOString(),
      active_effects:     effectsAfter,
    })
    .eq('id', hero.id)
    .eq('status', 'idle')
    .select('id')

  if (claimError) return res.status(500).json({ error: claimError.message })
  if (!claimed || claimed.length === 0) {
    return res.status(409).json({ error: 'El héroe ya está ocupado' })
  }

  // Insertar la corrida
  const { data: run, error: runError } = await supabase
    .from('chamber_runs')
    .insert({
      hero_id:      hero.id,
      chamber_type: chamberType,
      difficulty,
      ends_at:      endsAt.toISOString(),
      status:       'active',
    })
    .select('*')
    .single()

  if (runError) {
    // Rollback: restaurar idle, HP y active_effects originales si la
    // inserción del run falla (devolvemos la poción de tiempo consumida).
    await supabase
      .from('heroes')
      .update({
        status:             'idle',
        current_hp:         currentHp,
        hp_last_updated_at: hero.hp_last_updated_at,
        status_ends_at:     null,
        active_effects:     hero.active_effects ?? {},
      })
      .eq('id', hero.id)
    return res.status(500).json({ error: runError.message })
  }

  return res.status(200).json({
    ok: true,
    run,
    hpCost,
    heroCurrentHp: hpAfter,
  })
}
