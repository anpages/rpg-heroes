import { getResearchBonuses } from './_research.js'

/**
 * Calcula las stats efectivas del héroe:
 * base + bonos del equipo equipado (durabilidad > 0) + bonos de cartas equipadas (× rango)
 * + bonos de runas incrustadas + amplificaciones (weapon_attack_amp, armor_defense_amp, enchantment_amp)
 * + bonos de investigación si se pasa playerId
 */
export async function getEffectiveStats(supabase, heroId, playerId = null) {
  const [heroRes, itemsRes, cardsRes] = await Promise.all([
    supabase
      .from('heroes')
      .select('attack, defense, strength, agility, intelligence, max_hp')
      .eq('id', heroId)
      .single(),
    supabase
      .from('inventory_items')
      .select('current_durability, equipped_slot, item_catalog(attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus), item_runes(rune_catalog(bonuses))')
      .eq('hero_id', heroId)
      .not('equipped_slot', 'is', null),
    supabase
      .from('hero_cards')
      .select('rank, skill_cards(bonuses, penalties)')
      .eq('hero_id', heroId)
      .not('slot_index', 'is', null),
  ])

  const hero = heroRes.data
  if (!hero) return null

  const stats = { ...hero }

  const STAT_MAP = { attack: 'attack', defense: 'defense', max_hp: 'max_hp', strength: 'strength', agility: 'agility', intelligence: 'intelligence' }

  // Acumular base de ataque de armas y defensa de armaduras para amplificación posterior
  let weaponAttackBase  = 0
  let armorDefenseBase  = 0

  // Acumular bonos de runas por stat para enchantment_amp
  const runeStatBonuses = {}

  for (const item of itemsRes.data ?? []) {
    if (item.current_durability <= 0) continue
    const c      = item.item_catalog
    const durPct = c.max_durability > 0 ? item.current_durability / c.max_durability : 1

    const attack       = Math.round((c.attack_bonus       ?? 0) * durPct)
    const defense      = Math.round((c.defense_bonus      ?? 0) * durPct)
    const hp           = Math.round((c.hp_bonus           ?? 0) * durPct)
    const strength     = Math.round((c.strength_bonus     ?? 0) * durPct)
    const agility      = Math.round((c.agility_bonus      ?? 0) * durPct)
    const intelligence = Math.round((c.intelligence_bonus ?? 0) * durPct)

    stats.attack       += attack
    stats.defense      += defense
    stats.max_hp       += hp
    stats.strength     += strength
    stats.agility      += agility
    stats.intelligence += intelligence
    weaponAttackBase  += attack
    armorDefenseBase  += defense

    // Bonos de runas incrustadas — también escalan con durabilidad
    for (const ir of item.item_runes ?? []) {
      for (const { stat, value } of ir.rune_catalog?.bonuses ?? []) {
        if (stat in STAT_MAP) {
          const runeVal = Math.round(value * durPct)
          stats[STAT_MAP[stat]] += runeVal
          runeStatBonuses[stat] = (runeStatBonuses[stat] ?? 0) + runeVal
        }
      }
    }
  }

  // Stats especiales de cartas de equipo
  let weaponAttackAmp   = 0   // fracción, ej. 0.15 por rango
  let armorDefenseAmp   = 0   // fracción
  let enchantmentAmp    = 0   // fracción — amplifica bonos de runas
  let durabilityMod     = 0   // flat: negativo = menos desgaste, positivo = más
  let itemDropRateBonus = 0   // fracción, ej. 0.05 por rango

  for (const card of cardsRes.data ?? []) {
    const sc   = card.skill_cards
    const rank = Math.min(card.rank, 5)
    for (const { stat, value } of sc.bonuses ?? []) {
      if      (stat in STAT_MAP)            stats[STAT_MAP[stat]] += Math.round(value * rank)
      else if (stat === 'weapon_attack_amp') weaponAttackAmp   += value * rank
      else if (stat === 'armor_defense_amp') armorDefenseAmp   += value * rank
      else if (stat === 'enchantment_amp')   enchantmentAmp    += value * rank
      else if (stat === 'item_drop_rate')    itemDropRateBonus += value * rank
      else if (stat === 'durability_loss')   durabilityMod     += Math.round(value * rank)
    }
    for (const { stat, value } of sc.penalties ?? []) {
      if      (stat in STAT_MAP)           stats[STAT_MAP[stat]] -= Math.round(value * (1 + (rank - 1) * 0.5))
      else if (stat === 'durability_loss') durabilityMod         += Math.round(value * (1 + (rank - 1) * 0.5))
    }
  }

  // Aplicar amplificaciones sobre los bonus ya sumados
  if (weaponAttackAmp > 0) stats.attack  += Math.round(weaponAttackBase * weaponAttackAmp)
  if (armorDefenseAmp > 0) stats.defense += Math.round(armorDefenseBase * armorDefenseAmp)
  if (enchantmentAmp  > 0) {
    for (const [stat, runeVal] of Object.entries(runeStatBonuses)) {
      if (runeVal > 0) stats[stat] += Math.round(runeVal * enchantmentAmp)
    }
  }

  // Aplicar bonos de investigación completada
  if (playerId) {
    const rb = await getResearchBonuses(supabase, playerId)

    if (rb.attack_pct > 0)       stats.attack        = Math.round(stats.attack        * (1 + rb.attack_pct))
    if (rb.defense_pct > 0)      stats.defense       = Math.round(stats.defense       * (1 + rb.defense_pct))
    if (rb.intelligence_pct > 0) stats.intelligence  = Math.round(stats.intelligence  * (1 + rb.intelligence_pct))

    // enchantment_amp de investigación amplifica los bonos de runas ya calculados
    if (rb.enchantment_amp > 0) {
      for (const [stat, runeVal] of Object.entries(runeStatBonuses)) {
        if (runeVal > 0) stats[stat] += Math.round(runeVal * rb.enchantment_amp)
      }
    }

    itemDropRateBonus += rb.item_drop_pct
  }

  return { ...stats, durabilityMod, itemDropRateBonus }
}
