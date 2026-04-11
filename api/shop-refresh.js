import { requireAuth } from './_auth.js'
import { SHOP_REFRESH_COST } from './_constants.js'
import { isUUID, snapshotResources } from './_validate.js'

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

  // Cargar recursos (con interpolación pasiva para no perder generación acumulada)
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()
  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  const snap = snapshotResources(resources)
  if (snap.gold < SHOP_REFRESH_COST) {
    return res.status(402).json({ error: 'Oro insuficiente para refrescar la tienda' })
  }

  const dateStr = new Date().toISOString().slice(0, 10)

  // Leer el contador actual para calcular el siguiente (upsert no permite SET col = col + 1)
  const { data: existing } = await supabase
    .from('hero_shop_refreshes')
    .select('refresh_count')
    .eq('hero_id', heroId)
    .eq('refresh_date', dateStr)
    .maybeSingle()

  const nextCount = (existing?.refresh_count ?? 0) + 1

  // Cobrar oro y escribir el contador en paralelo.
  // El filtro por last_collected_at actúa como CAS: si otra operación avanzó
  // el snapshot entre el read y el update, este falla silenciosamente y el
  // contador aún se incrementa, pero no se cobra — se reintenta en el cliente.
  const [{ error: resErr, count: resCount }, refreshResult] = await Promise.all([
    supabase.from('resources').update({
      gold:   snap.gold - SHOP_REFRESH_COST,
      iron:   snap.iron,
      wood:   snap.wood,
      mana:   snap.mana,
      last_collected_at: snap.nowIso,
    }, { count: 'exact' }).eq('player_id', user.id).eq('last_collected_at', snap.prevCollectedAt),

    supabase.from('hero_shop_refreshes').upsert(
      { hero_id: heroId, refresh_date: dateStr, refresh_count: nextCount },
      { onConflict: 'hero_id,refresh_date' }
    ),
  ])

  if (resErr) return res.status(500).json({ error: resErr.message })
  if (resCount === 0) return res.status(409).json({ error: 'Recursos actualizados por otra operación, reintenta' })
  if (refreshResult.error) return res.status(500).json({ error: refreshResult.error.message })

  return res.status(200).json({ ok: true, refreshCount: nextCount, goldSpent: SHOP_REFRESH_COST })
}
