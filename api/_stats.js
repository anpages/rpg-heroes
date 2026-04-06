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
      .select('rank, skill_cards(attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus)')
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

  for (const card of cardsRes.data ?? []) {
    const sc = card.skill_cards
    const r  = Math.min(card.rank, 20)
    stats.attack       += (sc.attack_bonus       ?? 0) * r
    stats.defense      += (sc.defense_bonus      ?? 0) * r
    stats.max_hp       += (sc.hp_bonus           ?? 0) * r
    stats.strength     += (sc.strength_bonus     ?? 0) * r
    stats.agility      += (sc.agility_bonus      ?? 0) * r
    stats.intelligence += (sc.intelligence_bonus ?? 0) * r
  }

  return stats
}
