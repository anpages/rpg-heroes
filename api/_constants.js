/** Constantes de la API. La lógica de juego vive en src/lib/gameConstants.js */

// Re-exportar para que los endpoints no necesiten conocer la ruta completa
export {
  UNLOCK_TRIGGERS,
  INVENTORY_BASE_LIMIT,
  HERO_SLOT_REQUIREMENTS,
  MAX_POTION_STACK,
  POTION_CRAFT_DURATION_MS,
  TRAINING_ROOM_STATS,
  CARD_SLOT_COUNT,
  CARD_MAX_RANK,
  REPAIR_COST_TABLE,
  DISMANTLE_GOLD_TABLE,
} from '../src/lib/gameConstants.js'

export const SHOP_SIZE      = 8
export const SHOP_MAX_STOCK = 1   // unidades por item por héroe por día

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
