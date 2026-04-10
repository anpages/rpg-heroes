import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { xpRateForLevel, xpThreshold } from '../src/lib/gameConstants.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, stat: onlyStat } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Obtener todos los héroes del jugador
  const { data: heroes } = await supabase
    .from('heroes')
    .select('id, strength, agility, attack, defense, intelligence, max_hp')
    .eq('player_id', user.id)

  if (!heroes?.length) return res.status(404).json({ error: 'No hay héroes' })
  if (!heroes.some(h => h.id === heroId)) return res.status(403).json({ error: 'No autorizado' })

  // Solo salas completamente construidas
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

  // Procesar TODOS los héroes del jugador
  const allGains = {}

  for (const hero of heroes) {
    const hid = hero.id

    // Obtener filas de entrenamiento de este héroe
    const { data: existingRows } = await supabase
      .from('hero_training')
      .select('*')
      .eq('hero_id', hid)
      .in('stat', availableStats)

    const rowsByStat = Object.fromEntries((existingRows ?? []).map(r => [r.stat, r]))

    // Crear filas para stats sin entrada previa
    const missingStats = availableStats.filter(s => !rowsByStat[s])
    if (missingStats.length > 0) {
      const { data: inserted } = await supabase
        .from('hero_training')
        .insert(missingStats.map(stat => ({
          hero_id: hid,
          stat,
          xp_bank: 0,
          total_gained: 0,
          last_collected_at: now.toISOString(),
        })))
        .select()
      ;(inserted ?? []).forEach(r => { rowsByStat[r.stat] = r })
    }

    const gains       = {}
    const updates     = []
    const heroUpdates = {}

    for (const stat of availableStats) {
      const row = rowsByStat[stat]
      if (!row) continue

      const room          = roomByStat[stat]
      const rate          = xpRateForLevel(room.level)
      const thr           = xpThreshold(row.total_gained)
      const lastCollected = new Date(row.last_collected_at)

      // XP acumulada desde última recogida — se para al llegar al umbral
      const hoursToThreshold = Math.max(0, (thr - row.xp_bank) / rate)
      const hoursElapsed     = (now - lastCollected) / 3_600_000
      const effectiveHours   = Math.min(hoursElapsed, hoursToThreshold)

      let pendingXp    = row.xp_bank + effectiveHours * rate
      let totalGained  = row.total_gained
      let statGains    = 0

      // Convertir XP en puntos de stat (máximo 1 por recolección ya que se para)
      while (pendingXp >= xpThreshold(totalGained)) {
        pendingXp   -= xpThreshold(totalGained)
        totalGained += 1
        statGains   += 1
      }

      if (statGains > 0) gains[stat] = statGains

      updates.push({
        hero_id:           hid,
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
        .eq('id', hid)
    }

    if (hid === heroId) allGains[hid] = gains
  }

  return res.status(200).json({ ok: true, gained: allGains[heroId] ?? {} })
}
