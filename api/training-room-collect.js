import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { xpThreshold } from '../src/lib/gameConstants.js'
import { TRAINING_ROOM_STATS } from './_constants.js'

/**
 * POST /api/training-room-collect
 * Canjea un punto de stat de una sala de entrenamiento.
 * Requiere xp_bank >= xpThreshold(total_gained).
 * Body: { heroId, stat }
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, stat } = req.body
  if (!heroId)         return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })
  if (!stat || !TRAINING_ROOM_STATS.includes(stat)) return res.status(400).json({ error: 'Stat inválido' })

  // Verificar que el héroe pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes')
    .select('id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  // Leer fila de entrenamiento
  const { data: row } = await supabase
    .from('hero_training')
    .select('xp_bank, total_gained')
    .eq('hero_id', heroId)
    .eq('stat', stat)
    .maybeSingle()

  if (!row) return res.status(404).json({ error: 'No hay datos de entrenamiento para este stat' })

  const cost = xpThreshold(row.total_gained)
  if (row.xp_bank < cost) {
    return res.status(409).json({ error: `XP insuficiente (${row.xp_bank}/${cost})`, code: 'INSUFFICIENT_XP' })
  }

  // Descontar XP y añadir punto ganado
  const newBank        = row.xp_bank - cost
  const newTotalGained = row.total_gained + 1

  const { error: updateError } = await supabase
    .from('hero_training')
    .update({
      xp_bank:          newBank,
      total_gained:     newTotalGained,
      last_collected_at: new Date().toISOString(),
    })
    .eq('hero_id', heroId)
    .eq('stat', stat)

  if (updateError) return res.status(500).json({ error: updateError.message })

  // Aplicar +1 al stat del héroe
  const { error: rpcError } = await supabase.rpc('apply_training_gains', {
    p_hero_id: heroId,
    p_gains:   { [stat]: 1 },
  })

  if (rpcError) return res.status(500).json({ error: rpcError.message })

  return res.status(200).json({ ok: true, stat, newBank, totalGained: newTotalGained })
}
