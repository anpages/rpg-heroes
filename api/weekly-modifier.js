import { requireAuth } from './_auth.js'
import { getOrCreateWeeklyModifier } from './_weeklyModifier.js'
import { isUUID } from './_validate.js'

/**
 * GET /api/weekly-modifier?heroId=...
 * Devuelve el modificador semanal del héroe, creándolo lazy si aún no existe
 * para esta semana. Filtra dungeons por nivel del héroe.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res, 'GET')
  if (!auth) return
  const { user, supabase } = auth

  const heroId = req.query?.heroId
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar que el héroe pertenece al usuario
  const { data: hero } = await supabase
    .from('heroes')
    .select('id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()
  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  const weekly = await getOrCreateWeeklyModifier(supabase, heroId)
  return res.status(200).json({ weekly })
}
