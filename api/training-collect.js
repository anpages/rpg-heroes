import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { xpRateForLevel, xpThreshold, TRAINING_XP_CAP_HOURS } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, stat: onlyStat } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar que el héroe pertenece al usuario
  const { data: hero, error: heroError } = await supabase
    .from('heroes')
    .select('id, player_id, strength, agility, attack, defense, intelligence')
    .eq('id', heroId)
    .single()

  if (heroError || !hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // Solo salas completamente construidas (built_at != null y sin building_ends_at activo de construcción inicial)
  const { data: allRooms } = await supabase
    .from('training_rooms')
    .select('stat, level, built_at, building_ends_at')
    .eq('player_id', user.id)

  const rooms = (allRooms ?? []).filter(r => r.built_at !== null && (!onlyStat || r.stat === onlyStat))

  if (!rooms || rooms.length === 0) {
    return res.status(200).json({ ok: true, gained: {} })
  }

  const roomByStat     = Object.fromEntries(rooms.map(r => [r.stat, r]))
  const availableStats = rooms.map(r => r.stat)
  const now            = new Date()

  // Obtener filas de entrenamiento del héroe para los stats disponibles
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

  const gains      = {}
  const updates    = []
  const heroUpdates = {}

  for (const stat of availableStats) {
    const row  = rowsByStat[stat]
    if (!row) continue

    const room          = roomByStat[stat]
    const rate          = xpRateForLevel(room.level)
    const lastCollected = new Date(row.last_collected_at)
    const hoursElapsed  = Math.min(TRAINING_XP_CAP_HOURS, (now - lastCollected) / 3_600_000)
    let   pendingXp     = row.xp_bank + hoursElapsed * rate
    let   totalGained   = row.total_gained
    let   statGains     = 0

    while (pendingXp >= xpThreshold(totalGained)) {
      pendingXp   -= xpThreshold(totalGained)
      totalGained += 1
      statGains   += 1
    }

    if (statGains > 0) gains[stat] = statGains

    updates.push({
      hero_id:           heroId,
      stat,
      xp_bank:           pendingXp,
      total_gained:      totalGained,
      last_collected_at: now.toISOString(),
    })

    if (statGains > 0) heroUpdates[stat] = (hero[stat] ?? 0) + statGains
  }

  if (updates.length > 0) {
    await supabase
      .from('hero_training')
      .upsert(updates, { onConflict: 'hero_id,stat' })
  }

  if (Object.keys(heroUpdates).length > 0) {
    await supabase
      .from('heroes')
      .update(heroUpdates)
      .eq('id', heroId)
  }

  return res.status(200).json({ ok: true, gained: gains })
}
