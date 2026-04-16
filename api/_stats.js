import { getResearchBonuses } from './_research.js'
import { computeClassLevelBonuses } from '../src/lib/gameConstants.js'

/**
 * Calcula las stats efectivas del heroe:
 * base + bonos del equipo equipado (durabilidad > 0) + bonos de tacticas equipadas (x nivel)
 * + bonos de investigacion si se pasa playerId
 */
export async function getEffectiveStats(supabase, heroId, playerId = null) {
  const [heroRes, itemsRes, tacticsRes] = await Promise.all([
    supabase
      .from('heroes')
      .select('attack, defense, strength, agility, intelligence, max_hp, class, class_level, training_bonuses')
      .eq('id', heroId)
      .single(),
    supabase
      .from('inventory_items')
      .select('current_durability, equipped_slot, enchantments, item_catalog(attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus, weight, max_durability)')
      .eq('hero_id', heroId)
      .not('equipped_slot', 'is', null),
    supabase
      .from('hero_tactics')
      .select('level, tactic_catalog(stat_bonuses)')
      .eq('hero_id', heroId)
      .not('slot_index', 'is', null),
  ])

  const hero = heroRes.data
  if (!hero) return null

  const stats = { ...hero }

  // Bonos de entrenamiento (acumulados en training_bonuses, separados del stat base)
  const tb = hero.training_bonuses ?? {}
  stats.strength     += tb.strength     ?? 0
  stats.agility      += tb.agility      ?? 0
  stats.attack       += tb.attack       ?? 0
  stats.defense      += tb.defense      ?? 0
  stats.max_hp       += tb.max_hp       ?? 0
  stats.intelligence += tb.intelligence ?? 0

  // Bonos de nivel de clase (por encima de nivel 1)
  const classBonuses = computeClassLevelBonuses(hero.class, hero.class_level ?? 1)
  for (const [stat, val] of Object.entries(classBonuses)) {
    if (stat in stats) stats[stat] += val
  }

  const STAT_MAP = { attack: 'attack', defense: 'defense', max_hp: 'max_hp', strength: 'strength', agility: 'agility', intelligence: 'intelligence' }

  let totalWeight       = 0
  let itemDropRateBonus = 0
  let durabilityMod     = 0

  for (const item of itemsRes.data ?? []) {
    if (item.current_durability <= 0) continue
    const c      = item.item_catalog
    totalWeight += c.weight ?? 0
    const durPct = c.max_durability > 0 ? item.current_durability / c.max_durability : 1

    stats.attack       += Math.round((c.attack_bonus       ?? 0) * durPct)
    stats.defense      += Math.round((c.defense_bonus      ?? 0) * durPct)
    stats.max_hp       += Math.round((c.hp_bonus           ?? 0) * durPct)
    stats.strength     += Math.round((c.strength_bonus     ?? 0) * durPct)
    stats.agility      += Math.round((c.agility_bonus      ?? 0) * durPct)
    stats.intelligence += Math.round((c.intelligence_bonus ?? 0) * durPct)

    // Encantamientos del ítem (escalados por durabilidad igual que los bonos base)
    const enc = item.enchantments ?? {}
    if (enc.attack_bonus)       stats.attack       += Math.round(enc.attack_bonus       * durPct)
    if (enc.defense_bonus)      stats.defense      += Math.round(enc.defense_bonus      * durPct)
    if (enc.hp_bonus)           stats.max_hp       += Math.round(enc.hp_bonus           * durPct)
    if (enc.strength_bonus)     stats.strength     += Math.round(enc.strength_bonus     * durPct)
    if (enc.agility_bonus)      stats.agility      += Math.round(enc.agility_bonus      * durPct)
    if (enc.intelligence_bonus) stats.intelligence += Math.round(enc.intelligence_bonus * durPct)
  }

  // Bonos de tacticas equipadas — escalan con nivel
  for (const t of tacticsRes.data ?? []) {
    const cat = t.tactic_catalog
    for (const { stat, value } of cat?.stat_bonuses ?? []) {
      if (stat in STAT_MAP) {
        stats[STAT_MAP[stat]] += Math.round((value ?? 0) * (t.level ?? 1))
      }
    }
  }

  // Aplicar bonos de investigacion completada
  if (playerId) {
    const rb = await getResearchBonuses(supabase, playerId)

    if (rb.attack_pct > 0)       stats.attack       = Math.round(stats.attack       * (1 + rb.attack_pct))
    if (rb.defense_pct > 0)      stats.defense      = Math.round(stats.defense      * (1 + rb.defense_pct))
    if (rb.intelligence_pct > 0) stats.intelligence = Math.round(stats.intelligence * (1 + rb.intelligence_pct))

    // Bonus de tacticas amplificado por investigacion
    if (rb.tactic_bonus_pct > 0) {
      for (const t of tacticsRes.data ?? []) {
        const cat = t.tactic_catalog
        for (const { stat, value } of cat?.stat_bonuses ?? []) {
          if (stat in STAT_MAP) {
            stats[STAT_MAP[stat]] += Math.round((value ?? 0) * (t.level ?? 1) * rb.tactic_bonus_pct)
          }
        }
      }
    }

    itemDropRateBonus += rb.item_drop_pct
  }

  // Penalizacion de agilidad por peso del equipo equipado
  const weightPenalty = Math.floor(totalWeight / 4)
  stats.agility = Math.max(0, stats.agility - weightPenalty)

  return { ...stats, totalWeight, weightPenalty, durabilityMod, itemDropRateBonus }
}

/**
 * Stats del héroe con equipo equipado al 100% de durabilidad.
 * Se usa para anclar al enemigo en combate rápido: el rival se genera
 * como si el héroe llevara el equipo en perfecto estado, de modo que
 * el desgaste real supone una desventaja efectiva en combate.
 * No incluye investigación ni tácticas (esos bonos no se degradan).
 */
export async function getFullStats(supabase, heroId) {
  const [heroRes, itemsRes] = await Promise.all([
    supabase
      .from('heroes')
      .select('attack, defense, strength, agility, intelligence, max_hp')
      .eq('id', heroId)
      .single(),
    supabase
      .from('inventory_items')
      .select('current_durability, equipped_slot, enchantments, item_catalog(attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus, weight, max_durability)')
      .eq('hero_id', heroId)
      .not('equipped_slot', 'is', null),
  ])

  const hero = heroRes.data
  if (!hero) return null

  const stats = { ...hero }
  let totalWeight = 0

  for (const item of itemsRes.data ?? []) {
    if (item.current_durability <= 0) continue
    const c = item.item_catalog
    totalWeight += c.weight ?? 0

    // Bonos al 100% de durabilidad
    stats.attack       += c.attack_bonus       ?? 0
    stats.defense      += c.defense_bonus      ?? 0
    stats.max_hp       += c.hp_bonus           ?? 0
    stats.strength     += c.strength_bonus     ?? 0
    stats.agility      += c.agility_bonus      ?? 0
    stats.intelligence += c.intelligence_bonus ?? 0

    const enc = item.enchantments ?? {}
    if (enc.attack_bonus)       stats.attack       += enc.attack_bonus
    if (enc.defense_bonus)      stats.defense      += enc.defense_bonus
    if (enc.hp_bonus)           stats.max_hp       += enc.hp_bonus
    if (enc.strength_bonus)     stats.strength     += enc.strength_bonus
    if (enc.agility_bonus)      stats.agility      += enc.agility_bonus
    if (enc.intelligence_bonus) stats.intelligence += enc.intelligence_bonus
  }

  const weightPenalty = Math.floor(totalWeight / 4)
  stats.agility = Math.max(0, stats.agility - weightPenalty)

  return stats
}
