import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { interpolateHP, expeditionHpDamage } from './_hp.js'
import { agilityDurationFactor } from '../src/lib/gameFormulas.js'
import { isUUID } from './_validate.js'

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { dungeonId, heroId, useProvisions, useVial, useAmuleto } = req.body
  if (!dungeonId) return res.status(400).json({ error: 'dungeonId requerido' })
  if (!heroId)    return res.status(400).json({ error: 'heroId requerido' })
  if (!isUUID(dungeonId)) return res.status(400).json({ error: 'dungeonId inválido' })
  if (!isUUID(heroId))    return res.status(400).json({ error: 'heroId inválido' })

  // Obtener héroe y verificar que pertenece al jugador
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, level, status, player_id, current_hp, max_hp, hp_last_updated_at, status_ends_at, active_effects')
    .eq('id', heroId)
    .eq('player_id', user.id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.status !== 'idle') return res.status(409).json({ error: 'El héroe ya está en una expedición' })

  // Verificar slots de expedición simultánea (base: 1 slot, +1 con investigación expedition_slots)
  const { getResearchBonuses } = await import('./_research.js')
  const rb = await getResearchBonuses(supabase, user.id)
  const maxExpeditions = 1 + rb.expedition_slots

  if (maxExpeditions >= 2) {
    const { count } = await supabase
      .from('expeditions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'traveling')
      .in('hero_id',
        (await supabase.from('heroes').select('id').eq('player_id', user.id)).data?.map(h => h.id) ?? []
      )

    if ((count ?? 0) >= maxExpeditions) {
      return res.status(409).json({ error: `Ya tienes ${maxExpeditions} expedición(es) activa(s)` })
    }
  }

  // Stats efectivas del héroe
  const stats = await getEffectiveStats(supabase, hero.id, user.id)

  const nowMs = Date.now()
  const currentHp = interpolateHP(hero, nowMs, stats?.max_hp)

  // Obtener mazmorra
  const { data: dungeon } = await supabase
    .from('dungeons')
    .select('*')
    .eq('id', dungeonId)
    .single()

  if (!dungeon) return res.status(404).json({ error: 'Mazmorra no encontrada' })
  if (hero.level < dungeon.min_hero_level) {
    return res.status(403).json({ error: `Necesitas nivel ${dungeon.min_hero_level} para entrar aquí` })
  }

  // ── Verificar consumibles ──────────────────────────────────────────────────

  // Provisiones (+15% oro, +10% XP)
  let provStock = null
  let hasProvisions = false
  if (useProvisions) {
    const { data: ps } = await supabase
      .from('player_crafted_items')
      .select('quantity')
      .eq('player_id', user.id)
      .eq('recipe_id', 'expedition_provisions')
      .maybeSingle()
    provStock = ps
    hasProvisions = ps && ps.quantity > 0
  }

  // Vial de Aceleración (-35% duración)
  let vialStock = null
  let vialUsed = false
  if (useVial) {
    const { data: vs } = await supabase
      .from('player_crafted_items')
      .select('quantity')
      .eq('player_id', user.id)
      .eq('recipe_id', 'vial_aceleracion')
      .maybeSingle()
    vialStock = vs
    vialUsed = vs && vs.quantity > 0
  }

  // Amuleto de Fortuna (+80% drop de equipo, aplicado en collect via loot_boost)
  let amuletoStock = null
  let amuletoUsed = false
  if (useAmuleto) {
    const { data: as } = await supabase
      .from('player_crafted_items')
      .select('quantity')
      .eq('player_id', user.id)
      .eq('recipe_id', 'amuleto_fortuna')
      .maybeSingle()
    amuletoStock = as
    amuletoUsed = as && as.quantity > 0
  }

  // ── Duración efectiva ──────────────────────────────────────────────────────
  // Agilidad (hasta −25%) + active_effects.time_reduction (potiones) + Vial (−35%)
  const baseDuration = dungeon.duration_minutes * (stats ? agilityDurationFactor(stats.agility) : 1)
  const existingTimeReduction = hero.active_effects?.time_reduction ?? 0
  const vialReduction = vialUsed ? 0.35 : 0
  const effectiveDuration = Math.max(
    1,
    Math.round(baseDuration * (1 - existingTimeReduction - vialReduction)),
  )

  const endsAt = new Date(Date.now() + effectiveDuration * 60 * 1000)

  // ── Oro y XP base (con bonus de provisiones) ──────────────────────────────
  const goldEarned = Math.floor(
    (dungeon.gold_min + Math.random() * (dungeon.gold_max - dungeon.gold_min)) *
    (hasProvisions ? 1.15 : 1)
  )
  const xpEarned = Math.round(dungeon.experience_reward * (hasProvisions ? 1.10 : 1))

  const woodEarned = 0
  const manaEarned = 0

  // ── HP cost ────────────────────────────────────────────────────────────────
  const hpCostReduction = hero.active_effects?.hp_cost_reduction ?? 0
  const baseHpDamage = expeditionHpDamage(stats?.max_hp ?? hero.max_hp, dungeon.duration_minutes, dungeon.difficulty, stats?.strength)
  const hpDamage = Math.round(baseHpDamage * (1 - hpCostReduction))
  if (currentHp <= hpDamage) {
    return res.status(409).json({
      error: `HP insuficiente. Esta expedición cuesta ${hpDamage} HP y tienes ${currentHp}.`,
      code: 'LOW_HP',
    })
  }
  const hpAfterExpedition = Math.max(1, currentHp - hpDamage)

  // ── active_effects tras inicio ─────────────────────────────────────────────
  // Consumir time_reduction y hp_cost_reduction (potiones activas).
  // El Amuleto añade loot_boost para que expedition-collect lo aplique.
  // xp/loot/gold boost se consumen en collect.
  const effectsAfter = { ...(hero.active_effects ?? {}) }
  if (existingTimeReduction) delete effectsAfter.time_reduction
  if (hpCostReduction)       delete effectsAfter.hp_cost_reduction
  if (amuletoUsed)           effectsAfter.loot_boost = (effectsAfter.loot_boost ?? 0) + 0.80

  // ── Reclamar héroe atómicamente ───────────────────────────────────────────
  const { data: claimed, error: claimError } = await supabase
    .from('heroes')
    .update({
      status:             'exploring',
      current_hp:         hpAfterExpedition,
      hp_last_updated_at: new Date(nowMs).toISOString(),
      status_ends_at:     endsAt.toISOString(),
      active_effects:     effectsAfter,
    })
    .eq('id', hero.id)
    .eq('status', 'idle')
    .select('id')

  if (claimError) return res.status(500).json({ error: claimError.message })
  if (!claimed || claimed.length === 0) {
    return res.status(409).json({ error: 'El héroe ya está en una expedición' })
  }

  // ── Crear expedición ───────────────────────────────────────────────────────
  const { error: expError } = await supabase
    .from('expeditions')
    .insert({
      hero_id: hero.id,
      dungeon_id: dungeonId,
      ends_at: endsAt.toISOString(),
      status: 'traveling',
      gold_earned: goldEarned,
      wood_earned: woodEarned,
      mana_earned: manaEarned,
      experience_earned: xpEarned,
    })

  if (expError) {
    await supabase
      .from('heroes')
      .update({
        status: 'idle',
        current_hp: currentHp,
        hp_last_updated_at: hero.hp_last_updated_at,
        status_ends_at: null,
        active_effects: hero.active_effects ?? {},
      })
      .eq('id', hero.id)
    return res.status(500).json({ error: expError.message })
  }

  // ── Consumir items tras insertar expedición ────────────────────────────────
  const consumePromises = []

  if (hasProvisions) {
    consumePromises.push(
      supabase.from('player_crafted_items')
        .update({ quantity: provStock.quantity - 1 })
        .eq('player_id', user.id).eq('recipe_id', 'expedition_provisions')
    )
  }
  if (vialUsed) {
    consumePromises.push(
      supabase.from('player_crafted_items')
        .update({ quantity: vialStock.quantity - 1 })
        .eq('player_id', user.id).eq('recipe_id', 'vial_aceleracion')
    )
  }
  if (amuletoUsed) {
    consumePromises.push(
      supabase.from('player_crafted_items')
        .update({ quantity: amuletoStock.quantity - 1 })
        .eq('player_id', user.id).eq('recipe_id', 'amuleto_fortuna')
    )
  }

  if (consumePromises.length > 0) await Promise.all(consumePromises)

  return res.status(200).json({
    ok: true,
    endsAt,
    hpDamage,
    heroCurrentHp: hpAfterExpedition,
    provisionsUsed: hasProvisions,
    vialUsed,
    amuletoUsed,
  })
}
