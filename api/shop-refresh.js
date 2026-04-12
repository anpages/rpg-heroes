import { requireAuth } from './_auth.js'
import { SHOP_REFRESH_COST } from './_constants.js'
import { isUUID } from './_validate.js'

/**
 * POST /api/shop-refresh { heroId }
 *
 * Cobra SHOP_REFRESH_COST oro al jugador, incrementa el contador de refresh
 * del día para ese héroe, y devuelve el nuevo valor. El contador es parte de
 * la semilla determinista de shop-daily, así que incrementarlo provoca una
 * rotación nueva cuando el cliente vuelve a llamar al endpoint.
 *
 * El contador se resetea implícitamente al pasar de día (la fila pertenece
 * a un (hero_id, refresh_date) concreto).
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId) return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar que el héroe pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes')
    .select('id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()
  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  // Deducir oro (atómico via RPC)
  const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', { p_player_id: user.id, p_gold: SHOP_REFRESH_COST })
  if (rpcErr) return res.status(500).json({ error: rpcErr.message })
  if (!ok) return res.status(402).json({ error: 'Oro insuficiente para refrescar la tienda' })

  const dateStr = new Date().toISOString().slice(0, 10)

  // Leer el contador actual para calcular el siguiente (upsert no permite SET col = col + 1)
  const { data: existing } = await supabase
    .from('hero_shop_refreshes')
    .select('refresh_count')
    .eq('hero_id', heroId)
    .eq('refresh_date', dateStr)
    .maybeSingle()

  const nextCount = (existing?.refresh_count ?? 0) + 1

  const { error: refreshErr } = await supabase.from('hero_shop_refreshes').upsert(
    { hero_id: heroId, refresh_date: dateStr, refresh_count: nextCount },
    { onConflict: 'hero_id,refresh_date' }
  )
  if (refreshErr) return res.status(500).json({ error: refreshErr.message })

  return res.status(200).json({ ok: true, refreshCount: nextCount, goldSpent: SHOP_REFRESH_COST })
}
