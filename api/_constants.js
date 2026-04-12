/** Constantes de la API. La lógica de juego vive en src/lib/gameConstants.js */

// Re-exportar para que los endpoints no necesiten conocer la ruta completa
export {
  UNLOCK_TRIGGERS,
  INVENTORY_BASE_LIMIT,
  BAG_SLOTS_PER_UPGRADE,
  BAG_UPGRADE_COSTS,
  BAG_MAX_UPGRADES,
  HERO_SLOT_REQUIREMENTS,
  MAX_POTION_STACK,
  POTION_CRAFT_DURATION_MS,
  TRAINING_ROOM_STATS,
  TACTIC_SLOT_COUNT,
  TACTIC_MAX_LEVEL,
  TACTIC_SWAP_COST,
  REPAIR_COST_TABLE,
  REPAIR_IRON_BY_RARITY,
  REPAIR_IRON_SLOT_MULT,
  DISMANTLE_GOLD_TABLE,
  DISMANTLE_TRANSMUTE_TABLE,
  CRAFTING_SLOTS_BASE,
  REFINING_SLOTS_BASE,
  REFINING_SLOTS_EXPANDED_LEVEL,
  LAB_INVENTORY_BASE,
  LAB_INVENTORY_PER_UPGRADE,
  LAB_INVENTORY_MAX_UPGRADES,
  LAB_INVENTORY_UPGRADE_COSTS,
} from '../src/lib/gameConstants.js'

export const SHOP_SIZE           = 7    // items regulares de equipo por día (+ 2 specials = 9 cards, 3×3 grid)
export const SHOP_SPECIAL_COUNT  = 2    // ofertas especiales rotativas por día
export const SHOP_MAX_STOCK      = 1    // unidades por item por héroe por día
export const SHOP_REFRESH_COST   = 500  // oro fijo por refresh manual del stock

export const MERCHANT_TYPES = [
  { key: 'weapons', label: 'Armero',     slots: ['main_hand', 'off_hand'] },
  { key: 'armor',   label: 'Herrero',    slots: ['helmet', 'chest', 'arms', 'legs'] },
  { key: 'relics',  label: 'Reliquiero', slots: ['accessory'] },
]

/** Nivel mínimo de héroe para comprar un item según tier y rareza */
export function getItemMinLevel(tier, rarity) {
  const table = {
    1: { common: 1,  uncommon: 5,  rare: 10 },
    2: { common: 12, uncommon: 18, rare: 25 },
    3: { common: 25, uncommon: 35, rare: 50 },
  }
  return table[tier]?.[rarity] ?? 1
}
