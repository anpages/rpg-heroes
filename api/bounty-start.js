import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { interpolateHP } from './_hp.js'
import { getEffectiveStats } from './_stats.js'
import {
  BOUNTY_COST,
  BOUNTY_DURATION_MIN,
  bountyHpCost,
} from '../src/lib/gameConstants.js'

/**
 * Inicia una caza en una ruta concreta del pool del héroe.
 *
 * Flujo:
 *   1. Valida héroe + routeKey en el pool + no usada
 *   2. Chequea HP y recursos (iron/wood/gold)
 *   3. Descuenta recursos con snapshot + HP + lock del héroe a 'exploring'
 *   4. Marca la ruta como used=true en bounty_hunts.routes
 *   5. Inserta bounty_run con status='active' y ends_at
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, routeKey } = req.body
  if (!heroId)        return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })
  if (!routeKey || typeof routeKey !== 'string') {
    return res.status(400).json({ error: 'routeKey requerido' })
  }

  // Cargar héroe (usa status como lock compartido con cámaras/expediciones)
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, level, status, current_hp, max_hp, hp_last_updated_at, status_ends_at')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') {
    return res.status(409).json({ error: 'El héroe ya está ocupado' })
  }

  // Cargar pool de rutas
  const { data: hunt } = await supabase
    .from('bounty_hunts')
    .select('*')
    .eq('hero_id', heroId)
    .maybeSingle()

  if (!hunt) return res.status(404).json({ error: 'No hay rutas activas' })

  const routes = Array.isArray(hunt.routes) ? hunt.routes : []
  const routeIdx = routes.findIndex(r => r.key === routeKey)
  if (routeIdx === -1) return res.status(404).json({ error: 'Ruta no disponible en el pool' })
  if (routes[routeIdx].used) return res.status(409).json({ error: 'Esta ruta ya ha sido usada hoy' })

  // HP (max_hp efectivo con equipo para interpolar correctamente)
  const effStats = await getEffectiveStats(supabase, hero.id, user.id)
  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs, effStats?.max_hp)
  const hpCost = bountyHpCost(hero.max_hp)
  if (currentHp <= hpCost) {
    return res.status(409).json({
      error: `HP insuficiente. Esta caza cuesta ${hpCost} HP y tienes ${currentHp}.`,
      code: 'LOW_HP',
    })
  }

  // Recursos (con interpolación idle)
  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(500).json({ error: 'Recursos no encontrados' })

  const snap = snapshotResources(resources)
  if (snap.gold < BOUNTY_COST.gold) return res.status(402).json({ error: `Oro insuficiente (necesitas ${BOUNTY_COST.gold})` })

  const endsAt = new Date(nowMs + BOUNTY_DURATION_MIN * 60_000)
  const hpAfter = Math.max(1, currentHp - hpCost)

  // Lock atómico del héroe: 'idle' → 'exploring'
  const { data: claimed, error: claimError } = await supabase
    .from('heroes')
    .update({
      status:             'exploring',
      current_hp:         hpAfter,
      hp_last_updated_at: new Date(nowMs).toISOString(),
      status_ends_at:     endsAt.toISOString(),
    })
    .eq('id', hero.id)
    .eq('status', 'idle')
    .select('id')

  if (claimError) return res.status(500).json({ error: claimError.message })
  if (!claimed || claimed.length === 0) {
    return res.status(409).json({ error: 'El héroe ya está ocupado' })
  }

  // Descontar recursos (guard optimistic por last_collected_at)
  const { error: resError, count: resCount } = await supabase
    .from('resources')
    .update({
      gold:              snap.gold - BOUNTY_COST.gold,
      iron:              snap.iron,
      wood:              snap.wood,
      mana:              snap.mana,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)
    .eq('last_collected_at', snap.prevCollectedAt)

  if (resError || resCount === 0) {
    // Rollback lock del héroe si falla el descuento de recursos
    await supabase
      .from('heroes')
      .update({
        status:             'idle',
        current_hp:         currentHp,
        hp_last_updated_at: hero.hp_last_updated_at,
        status_ends_at:     null,
      })
      .eq('id', hero.id)
    return res.status(409).json({ error: resError?.message ?? 'Recursos desincronizados, reintenta' })
  }

  // Marcar ruta como usada (copiar array, flip used, update jsonb)
  const newRoutes = routes.map((r, i) => i === routeIdx ? { ...r, used: true } : r)
  const { error: huntError } = await supabase
    .from('bounty_hunts')
    .update({ routes: newRoutes })
    .eq('hero_id', heroId)

  if (huntError) return res.status(500).json({ error: huntError.message })

  // Insertar run
  const route = routes[routeIdx]
  const { data: run, error: runError } = await supabase
    .from('bounty_runs')
    .insert({
      hero_id:    heroId,
      route_key:  route.key,
      slot:       route.slot,
      ends_at:    endsAt.toISOString(),
      status:     'active',
    })
    .select('*')
    .single()

  if (runError) return res.status(500).json({ error: runError.message })

  return res.status(200).json({
    ok:          true,
    run,
    hpCost,
    routes:      newRoutes,
    heroCurrentHp: hpAfter,
  })
}
