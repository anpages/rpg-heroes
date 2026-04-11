import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { verifyChestToken } from './_combatSign.js'
import { applyChamberChestLoot } from './_chamberLoot.js'
import { xpRequiredForLevel } from '../src/lib/gameFormulas.js'
import { progressMissions } from './_missions.js'
import { interpolateHP } from './_hp.js'

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

  const { token, chosenIndex } = req.body
  if (!token) return res.status(400).json({ error: 'token requerido' })
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0) {
    return res.status(400).json({ error: 'chosenIndex requerido' })
  }

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

  // ── 2. Buscar el cofre elegido por índice en el array firmado ─────────────
  // Los 3 cofres son del mismo arquetipo, así que distinguimos por posición.
  const chests = payload.chests ?? []
  if (chosenIndex >= chests.length) {
    return res.status(400).json({ error: 'Cofre no válido' })
  }
  const chest = chests[chosenIndex]

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
    .select('id, player_id, level, experience, class, active_effects, status, current_hp, max_hp, hp_last_updated_at, status_ends_at')
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

  // ── 5. Aplicar oro / fragmentos ───────────────────────────────────────────
  // Las cámaras solo dan oro, fragmentos e items. NUNCA wood/iron/mana
  // (esos son exclusivos de los edificios productores).
  const snap = snapshotResources(resources)
  const fragmentsAdd = chest.material?.resource === 'fragments' ? chest.material.qty : 0

  const { error: resourcesError } = await supabase
    .from('resources')
    .update({
      gold:      snap.gold + (chest.gold ?? 0),
      iron:      snap.iron,
      wood:      snap.wood,
      mana:      snap.mana,
      fragments: (resources.fragments ?? 0) + fragmentsAdd,
      last_collected_at: snap.nowIso,
    })
    .eq('player_id', user.id)

  if (resourcesError) return res.status(500).json({ error: resourcesError.message })

  // ── 6. Aplicar XP y posible level-up ──────────────────────────────────────
  const xpEarned = chest.xp ?? 0
  const newXp = hero.experience + xpEarned
  const xpForLevel = xpRequiredForLevel(hero.level)
  const levelUp = newXp >= xpForLevel

  // Devuelve al héroe a idle (chamber-start lo dejó en 'exploring' como lock).
  // Aplica regen pasiva acumulada desde que terminó la cámara (status_ends_at).
  const regeneratedHp = interpolateHP(hero, Date.now())
  const { error: heroError } = await supabase
    .from('heroes')
    .update({
      status:             'idle',
      experience:         levelUp ? newXp - xpForLevel : newXp,
      level:              levelUp ? hero.level + 1     : hero.level,
      current_hp:         regeneratedHp,
      hp_last_updated_at: new Date().toISOString(),
      status_ends_at:     null,
    })
    .eq('id', hero.id)

  if (heroError) return res.status(500).json({ error: heroError.message })

  // ── 7. Rolear el item concreto a partir del hint firmado ─────────────────
  const { drop } = await applyChamberChestLoot(supabase, hero, chest)

  // ── 8. Marcar el run como completado ──────────────────────────────────────
  const reward = {
    gold:     chest.gold ?? 0,
    xp:       xpEarned,
    material: chest.material ?? null,
    item:     drop ? { id: drop.id, name: drop.item_catalog?.name } : null,
  }
  await supabase
    .from('chamber_runs')
    .update({
      status:        'completed',
      collected_at:  new Date().toISOString(),
      chosen_chest:  String(chosenIndex),
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
    chosenIndex,
    rewards: { gold: chest.gold ?? 0, experience: xpEarned },
    levelUp,
    drop:     drop     ?? null,
    material: chest.material ?? null,
  })
}
