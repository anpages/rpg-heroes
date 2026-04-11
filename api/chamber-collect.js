import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { signChestToken } from './_combatSign.js'
import { rollChamberChests } from './_chamberLoot.js'
import { CHAMBER_CHOICE_TOKEN_TTL_MS } from '../src/lib/gameConstants.js'

/**
 * Genera 3 cofres firmados que el cliente verá antes de elegir.
 *
 * Este endpoint NO aplica recompensas ni marca la cámara como completada.
 * Solo:
 *   1. valida que la cámara existe, pertenece al usuario, y ha terminado
 *   2. rolea los 3 cofres
 *   3. marca el run como 'awaiting_choice'
 *   4. firma los cofres con HMAC y devuelve { chests, token }
 *
 * El cliente luego llama a chamber-confirm con { token, chosen }.
 *
 * Reroll: si el jugador deja la app y el token expira (15 min), puede llamar
 * de nuevo a este endpoint y obtendrá 3 cofres NUEVOS (otro reroll). Esto
 * está bien porque el HP ya se gastó al iniciar — no hay arbitraje gratis.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { runId } = req.body
  if (!runId)         return res.status(400).json({ error: 'runId requerido' })
  if (!isUUID(runId)) return res.status(400).json({ error: 'runId inválido' })

  const { data: run } = await supabase
    .from('chamber_runs')
    .select('*, heroes!inner(id, player_id, active_effects)')
    .eq('id', runId)
    .single()

  if (!run) return res.status(404).json({ error: 'Cámara no encontrada' })
  if (run.heroes.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })
  if (run.status === 'completed')        return res.status(409).json({ error: 'Esta cámara ya fue recogida' })
  if (new Date(run.ends_at) > new Date()) return res.status(409).json({ error: 'La cámara aún no ha terminado' })

  // loot_boost aumenta la probabilidad de itemHint por cofre. Se consume
  // solo en la primera llamada; si el jugador reroll tras expiración del
  // token ya no habrá boost activo (igual que en expediciones).
  const lootBoost = run.heroes.active_effects?.loot_boost ?? 0
  const chests = rollChamberChests(run.chamber_type, run.difficulty, lootBoost)

  // Marcar como esperando decisión (idempotente — soporta rerolls tras expiración)
  const { error: updateError } = await supabase
    .from('chamber_runs')
    .update({ status: 'awaiting_choice' })
    .eq('id', runId)

  if (updateError) return res.status(500).json({ error: updateError.message })

  // Consumir loot_boost tras rolar (solo si estaba activo).
  if (lootBoost) {
    const newEffects = { ...(run.heroes.active_effects ?? {}) }
    delete newEffects.loot_boost
    await supabase
      .from('heroes')
      .update({ active_effects: newEffects })
      .eq('id', run.hero_id)
  }

  // Firmar el token con todo lo necesario para chamber-confirm
  const token = signChestToken(
    {
      userId: user.id,
      runId,
      heroId: run.hero_id,
      chests,
    },
    CHAMBER_CHOICE_TOKEN_TTL_MS,
  )

  return res.status(200).json({ ok: true, chests, token })
}
