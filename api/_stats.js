/**
 * Calcula las stats efectivas del héroe:
 * base + bonos del equipo equipado (durabilidad > 0) + bonos de cartas equipadas (× rango)
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
      .select('current_durability, item_catalog(attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus)')
      .eq('hero_id', heroId)
      .not('equipped_slot', 'is', null),
    supabase
      .from('hero_cards')
      .select('rank, skill_cards(bonuses, penalties)')
      .eq('hero_id', heroId)
      .eq('equipped', true),
  ])

  const hero = heroRes.data
  if (!hero) return null

  const stats = { ...hero }

  for (const item of itemsRes.data ?? []) {
    if (item.current_durability <= 0) continue
    const c = item.item_catalog
    stats.attack       += c.attack_bonus       ?? 0
    stats.defense      += c.defense_bonus      ?? 0
    stats.max_hp       += c.hp_bonus           ?? 0
    stats.strength     += c.strength_bonus     ?? 0
    stats.agility      += c.agility_bonus      ?? 0
    stats.intelligence += c.intelligence_bonus ?? 0
  }

  const STAT_MAP = { attack: 'attack', defense: 'defense', max_hp: 'max_hp', strength: 'strength', agility: 'agility', intelligence: 'intelligence' }
  for (const card of cardsRes.data ?? []) {
    const sc   = card.skill_cards
    const rank = Math.min(card.rank, 5)
    for (const { stat, value } of sc.bonuses   ?? []) { if (stat in STAT_MAP) stats[STAT_MAP[stat]] += value * rank }
    for (const { stat, value } of sc.penalties ?? []) { if (stat in STAT_MAP) stats[STAT_MAP[stat]] -= value * rank }
  }

  return stats
}
