import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { verifyChestToken } from './_combatSign.js'
import { applyChamberChestLoot } from './_chamberLoot.js'
import { xpRequiredForLevel } from '../src/lib/gameFormulas.js'
import { progressMissions } from './_missions.js'

/**
 * Aplica la elección de cofre del jugador.
 *
 * Flow:
 *   1. Verificar token HMAC (firma + expiración + userId)
 *   2. Encontrar el cofre elegido en el array firmado
 *   3. Cargar héroe y recursos
 *   4. Aplicar oro/xp/material al snapshot de recursos
 *   5. Rolear item/carta concretos si el cofre los tenía (vía applyChamberChestLoot)
 *   6. Marcar el chamber_run como completed con la recompensa real
 *   7. Devolver el resultado al cliente
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { token, chosen } = req.body
  if (!token)  return res.status(400).json({ error: 'token requerido' })
  if (!chosen) return res.status(400).json({ error: 'chosen requerido' })

  // ── 1. Verificar firma ────────────────────────────────────────────────────
  let payload
  try {
    payload = verifyChestToken(token)
  } catch (e) {
    return res.status(403).json({ error: e.message })
  }
  if (payload.userId !== user.id) {
    return res.status(403).json({ error: 'No autorizado' })
  }
  if (!isUUID(payload.runId)) {
    return res.status(400).json({ error: 'runId inválido en token' })
  }

  // ── 2. Buscar el cofre elegido en el array firmado ────────────────────────
  const chest = (payload.chests ?? []).find(c => c.archetype === chosen)
  if (!chest) return res.status(400).json({ error: 'Cofre no válido' })

  // ── 3. Cargar el run para asegurar consistencia ───────────────────────────
  const { data: run } = await supabase
    .from('chamber_runs')
    .select('*')
    .eq('id', payload.runId)
    .single()

  if (!run) return res.status(404).json({ error: 'Cámara no encontrada' })
  if (run.status === 'completed') {
    return res.status(409).json({ error: 'Esta cámara ya fue recogida' })
  }
  if (run.hero_id !== payload.heroId) {
    return res.status(403).json({ error: 'Héroe no coincide con el token' })
  }

  // ── 4. Cargar héroe y recursos ────────────────────────────────────────────
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, level, experience, class, active_effects')
    .eq('id', run.hero_id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const { data: resources } = await supabase
    .from('resources')
    .select('gold, iron, wood, mana, fragments, essence, iron_rate, wood_rate, mana_rate, last_collected_at')
    .eq('player_id', user.id)
    .single()

  if (!resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  // ── 5. Aplicar oro / material ─────────────────────────────────────────────
  const snap = snapshotResources(resources)
  const fragmentsAdd = chest.material?.resource === 'fragments' ? chest.material.qty : 0
  const essenceAdd   = chest.material?.resource === 'essence'   ? chest.material.qty : 0

  const { error: resourcesError } = await supabase
    .from('resources')
    .update({
      gold:      snap.gold + (chest.gold ?? 0),
      iron:      snap.iron,
      wood:      snap.wood,
      mana:      snap.mana,
      fragments: (resources.fragments ?? 0) + fragmentsAdd,
      essence:   (resources.essence   ?? 0) + essenceAdd,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)

  if (resourcesError) return res.status(500).json({ error: resourcesError.message })

  // ── 6. Aplicar XP y posible level-up ──────────────────────────────────────
  const xpEarned = chest.xp ?? 0
  const newXp = hero.experience + xpEarned
  const xpForLevel = xpRequiredForLevel(hero.level)
  const levelUp = newXp >= xpForLevel

  // Devuelve al héroe a idle (chamber-start lo dejó en 'exploring' como lock)
  const { error: heroError } = await supabase
    .from('heroes')
    .update({
      status:             'idle',
      experience:         levelUp ? newXp - xpForLevel : newXp,
      level:              levelUp ? hero.level + 1     : hero.level,
      hp_last_updated_at: new Date().toISOString(),
    })
    .eq('id', hero.id)

  if (heroError) return res.status(500).json({ error: heroError.message })

  // ── 7. Rolear item/carta concretos a partir de los hints firmados ─────────
  const { drop, cardDrop } = await applyChamberChestLoot(supabase, hero, chest)

  // ── 8. Marcar el run como completado ──────────────────────────────────────
  const reward = {
    gold:     chest.gold ?? 0,
    xp:       xpEarned,
    material: chest.material ?? null,
    item:     drop ? { id: drop.id, name: drop.item_catalog?.name } : null,
    card:     cardDrop ? { id: cardDrop.id, name: cardDrop.skill_cards?.name } : null,
  }
  await supabase
    .from('chamber_runs')
    .update({
      status:        'completed',
      collected_at:  new Date().toISOString(),
      chosen_chest:  chosen,
      reward,
    })
    .eq('id', run.id)

  // Misiones diarias (no bloquean la respuesta)
  Promise.all([
    progressMissions(supabase, user.id, 'gold_earn', chest.gold ?? 0),
    progressMissions(supabase, user.id, 'xp_earn',   xpEarned),
    drop ? progressMissions(supabase, user.id, 'item_drop', 1) : Promise.resolve(),
  ]).catch(e => console.error('mission progress error:', e.message))

  return res.status(200).json({
    ok: true,
    chosen,
    rewards: { gold: chest.gold ?? 0, experience: xpEarned },
    levelUp,
    drop:     drop     ?? null,
    cardDrop: cardDrop ?? null,
    material: chest.material ?? null,
  })
}
