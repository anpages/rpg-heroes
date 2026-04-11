import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import {
  BOUNTY_ROUTES_CATALOG,
  BOUNTY_POOL_SIZE,
  BOUNTY_RESET_MS,
} from '../src/lib/gameConstants.js'

/**
 * Devuelve el estado de las rutas de Caza de Botín para un héroe.
 *
 * Lazy-rolls el pool si:
 *   - el héroe no tiene fila en bounty_hunts aún
 *   - reset_at ya ha pasado (ventana diaria caducada)
 *
 * También incluye el run activo si existe (status='active') para que la UI
 * pueda mostrar countdown sin una segunda query.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId } = req.body
  if (!heroId)        return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })

  // Verificar propiedad del héroe
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })

  // Cargar pool actual (si existe)
  const { data: existing } = await supabase
    .from('bounty_hunts')
    .select('*')
    .eq('hero_id', heroId)
    .maybeSingle()

  const now = Date.now()
  const needsRoll = !existing || new Date(existing.reset_at).getTime() <= now

  let hunt = existing
  if (needsRoll) {
    const routes = rollPool()
    const resetAt = new Date(now + BOUNTY_RESET_MS).toISOString()
    const { data: upserted, error } = await supabase
      .from('bounty_hunts')
      .upsert({
        hero_id:       heroId,
        routes,
        reset_at:      resetAt,
        regens_today:  0,
      }, { onConflict: 'hero_id' })
      .select('*')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    hunt = upserted
  }

  // Cargar run activo si existe
  const { data: activeRun } = await supabase
    .from('bounty_runs')
    .select('*')
    .eq('hero_id', heroId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return res.status(200).json({
    ok:           true,
    routes:       hunt.routes,
    resetAt:      hunt.reset_at,
    regensToday:  hunt.regens_today,
    activeRun:    activeRun ?? null,
  })
}

/**
 * Sortea BOUNTY_POOL_SIZE rutas distintas del catálogo.
 * Prohíbe slots duplicados (es decir, nunca salen 2 rutas del mismo slot).
 */
export function rollPool() {
  const bySlot = new Map()
  for (const route of BOUNTY_ROUTES_CATALOG) {
    if (!bySlot.has(route.slot)) bySlot.set(route.slot, [])
    bySlot.get(route.slot).push(route)
  }

  const slots = [...bySlot.keys()]
  const picked = []
  while (picked.length < BOUNTY_POOL_SIZE && slots.length > 0) {
    const idx = Math.floor(Math.random() * slots.length)
    const slot = slots.splice(idx, 1)[0]
    const options = bySlot.get(slot)
    const route = options[Math.floor(Math.random() * options.length)]
    picked.push({ key: route.key, slot: route.slot, used: false })
  }

  return picked
}
