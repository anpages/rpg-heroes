import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { xpRateForLevel, xpThreshold } from '../src/lib/gameConstants.js'

/**
 * POST /api/training-collect
 * Recolecta XP de entrenamiento de todas las salas construidas.
 * En vez de aplicar stat points directamente, produce tokens en
 * player_training_tokens que el jugador asigna manualmente a cualquier héroe.
 *
 * Body: { heroId, stat? }
 *   heroId: héroe de referencia (para tracking de XP y training_boost)
 *   stat:   si se pasa, solo procesa esa sala
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, stat: onlyStat } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, active_effects')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(403).json({ error: 'No autorizado' })

  // Solo salas completamente construidas
  const { data: allRooms } = await supabase
    .from('training_rooms')
    .select('stat, level, built_at, building_ends_at')
    .eq('player_id', user.id)

  const now = new Date()
  const rooms = (allRooms ?? []).filter(r =>
    r.built_at !== null &&
    (!r.building_ends_at || new Date(r.building_ends_at) <= now) &&
    (!onlyStat || r.stat === onlyStat)
  )

  if (!rooms || rooms.length === 0) {
    return res.status(200).json({ ok: true, gained: {} })
  }

  const roomByStat     = Object.fromEntries(rooms.map(r => [r.stat, r]))
  const availableStats = rooms.map(r => r.stat)

  // Obtener filas de entrenamiento del héroe
  const { data: existingRows } = await supabase
    .from('hero_training')
    .select('*')
    .eq('hero_id', heroId)
    .in('stat', availableStats)

  const rowsByStat = Object.fromEntries((existingRows ?? []).map(r => [r.stat, r]))

  // Crear filas para stats sin entrada previa
  const missingStats = availableStats.filter(s => !rowsByStat[s])
  if (missingStats.length > 0) {
    const { data: inserted } = await supabase
      .from('hero_training')
      .insert(missingStats.map(stat => ({
        hero_id: heroId,
        stat,
        xp_bank: 0,
        total_gained: 0,
        last_collected_at: now.toISOString(),
      })))
      .select()
    ;(inserted ?? []).forEach(r => { rowsByStat[r.stat] = r })
  }

  const gains          = {}
  const updates        = []
  const trainingBoost  = hero.active_effects?.training_boost ?? 0
  const tokenGains     = {}

  for (const stat of availableStats) {
    const row = rowsByStat[stat]
    if (!row) continue

    const room          = roomByStat[stat]
    const rate          = xpRateForLevel(room.level)
    const thr           = xpThreshold(row.total_gained)
    // XP solo puede acumularse desde que la sala fue construida,
    // no desde una sesión anterior (evita XP gratis en resets de datos).
    const lastCollected = new Date(Math.max(
      new Date(row.last_collected_at).getTime(),
      new Date(room.built_at).getTime(),
    ))

    // XP acumulada desde última recogida — se para al llegar al umbral
    const hoursToThreshold = Math.max(0, (thr - row.xp_bank) / rate)
    const hoursElapsed     = (now - lastCollected) / 3_600_000
    const effectiveHours   = Math.min(hoursElapsed, hoursToThreshold)

    let pendingXp    = row.xp_bank + effectiveHours * rate * (1 + trainingBoost)
    let totalGained  = row.total_gained
    let statGains    = 0

    while (pendingXp >= xpThreshold(totalGained)) {
      pendingXp   -= xpThreshold(totalGained)
      totalGained += 1
      statGains   += 1
    }

    if (statGains > 0) {
      gains[stat] = statGains
      tokenGains[stat] = statGains
    }

    updates.push({
      hero_id:           heroId,
      stat,
      xp_bank:           pendingXp,
      total_gained:      totalGained,
      last_collected_at: now.toISOString(),
    })
  }

  // Actualizar XP banks
  if (updates.length > 0) {
    await supabase
      .from('hero_training')
      .upsert(updates, { onConflict: 'hero_id,stat' })
  }

  // Producir tokens — RPC atómica, sin race condition
  if (Object.keys(tokenGains).length > 0) {
    await supabase.rpc('add_training_tokens', { p_player_id: user.id, p_gains: tokenGains })

    // Consumir training_boost si se usó
    if (trainingBoost) {
      const newEffects = { ...(hero.active_effects ?? {}) }
      delete newEffects.training_boost
      await supabase
        .from('heroes')
        .update({ active_effects: newEffects })
        .eq('id', heroId)
    }
  }

  return res.status(200).json({ ok: true, gained: gains })
}
