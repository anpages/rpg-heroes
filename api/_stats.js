/**
 * Calcula las stats efectivas del héroe:
 * base + bonos del equipo equipado (durabilidad > 0) + bonos de cartas equipadas (× rango)
 * + bonos de runas incrustadas + amplificaciones (weapon_attack_amp, armor_defense_amp, enchantment_amp)
 */
export async function getEffectiveStats(supabase, heroId) {
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
    const c = item.item_catalog
    stats.attack       += c.attack_bonus       ?? 0
    stats.defense      += c.defense_bonus      ?? 0
    stats.max_hp       += c.hp_bonus           ?? 0
    stats.strength     += c.strength_bonus     ?? 0
    stats.agility      += c.agility_bonus      ?? 0
    stats.intelligence += c.intelligence_bonus ?? 0
    weaponAttackBase  += c.attack_bonus  ?? 0
    armorDefenseBase  += c.defense_bonus ?? 0

    // Bonos de runas incrustadas
    for (const ir of item.item_runes ?? []) {
      for (const { stat, value } of ir.rune_catalog?.bonuses ?? []) {
        if (stat in STAT_MAP) {
          stats[STAT_MAP[stat]] += value
          runeStatBonuses[stat] = (runeStatBonuses[stat] ?? 0) + value
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

  return { ...stats, durabilityMod, itemDropRateBonus }
}
