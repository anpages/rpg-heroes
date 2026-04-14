import { requireAuth } from './_auth.js'
import { isUUID } from './_validate.js'
import { DISMANTLE_TABLE, DISMANTLE_RUNE_BONUS } from './_constants.js'

function countRunesApplied(enchantments) {
  if (!enchantments) return 0
  // Valores base por stat de runa
  const BASE = { attack_bonus: 10, defense_bonus: 10, hp_bonus: 80, strength_bonus: 8, agility_bonus: 8, intelligence_bonus: 8 }
  return Object.entries(enchantments).reduce((n, [stat, val]) => {
    const base = BASE[stat] ?? 1
    return n + Math.round(val / base)
  }, 0)
}

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { itemId } = req.body
  if (!itemId) return res.status(400).json({ error: 'itemId requerido' })
  if (!isUUID(itemId)) return res.status(400).json({ error: 'itemId inválido' })

  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, hero_id, equipped_slot, enchantments, item_catalog(rarity, tier)')
    .eq('id', itemId)
    .single()

  if (!item) return res.status(404).json({ error: 'Item no encontrado' })
  if (item.equipped_slot) return res.status(409).json({ error: 'No puedes desmantelar un item equipado' })

  const { data: hero } = await supabase
    .from('heroes')
    .select('player_id')
    .eq('id', item.hero_id)
    .single()

  if (!hero || hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  const base  = DISMANTLE_TABLE[item.item_catalog.rarity] ?? DISMANTLE_TABLE.common
  const tier  = item.item_catalog.tier ?? 1
  const runes = countRunesApplied(item.enchantments)

  const gold      = base.gold      * tier + runes * DISMANTLE_RUNE_BONUS.gold
  const mana      = base.mana      * tier + runes * DISMANTLE_RUNE_BONUS.mana
  const fragments = base.fragments * tier
  const essence   = base.essence   * tier

  const { error: rpcError } = await supabase.rpc('dismantle_item_atomic', {
    p_item_id:   itemId,
    p_player_id: user.id,
    p_gold:      gold,
    p_mana:      mana,
    p_fragments: fragments,
    p_essence:   essence,
  })

  if (rpcError) return res.status(500).json({ error: rpcError.message })

  return res.status(200).json({ ok: true, gold, mana, fragments, essence })
}
