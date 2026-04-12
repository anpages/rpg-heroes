import { RESEARCH_NODES } from '../src/lib/gameConstants.js'

export const RESEARCH_BONUS_DEFAULTS = {
  attack_pct:          0,
  defense_pct:         0,
  intelligence_pct:    0,
  crit_pct:            0,
  tower_dmg_pct:       0,
  expedition_gold_pct: 0,
  durability_loss_pct: 0,
  expedition_xp_pct:   0,
  expedition_slots:    0,
  repair_cost_pct:     0,
  item_drop_pct:       0,
  mana_rate_pct:           0,
  tactic_drop_pct:         0,
  tactic_swap_discount:    0,
  tactic_bonus_pct:        0,
  tactic_max_level_bonus:  0,
}

/**
 * Calcula los bonos de investigación completados para un jugador.
 * Devuelve un objeto con todos los efectos sumados.
 */
export async function getResearchBonuses(supabase, playerId) {
  const { data } = await supabase
    .from('player_research')
    .select('node_id')
    .eq('player_id', playerId)
    .eq('status', 'completed')

  const bonuses      = { ...RESEARCH_BONUS_DEFAULTS }
  const completedIds = new Set((data ?? []).map(r => r.node_id))

  for (const node of RESEARCH_NODES) {
    if (completedIds.has(node.id)) bonuses[node.effect_type] += node.effect_value
  }

  return bonuses
}
