/** Constantes compartidas entre endpoints de la API */

export const INVENTORY_BASE_LIMIT        = 20
export const INVENTORY_PER_WORKSHOP_LEVEL = 5

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
