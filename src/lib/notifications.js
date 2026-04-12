import { toast } from 'sonner'

const RARITY_LABELS = {
  common: 'Común', uncommon: 'Poco común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario',
}
const SLOT_LABELS = {
  main_hand: 'Mano principal', off_hand:  'Mano secundaria',
  helmet:    'Casco',          chest:     'Pecho',
  arms:      'Brazos',         legs:      'Piernas',
  accessory: 'Accesorio',
}

const DURATION = {
  error:   4000,
  success: 2500,
  info:    2500,
  drop:    4000,
  bagFull: 5000,
}

export const notify = {
  error: (message) => {
    if (!message) return
    toast.error(String(message), { duration: DURATION.error })
  },

  success: (message) => {
    if (!message) return
    toast.success(message, { duration: DURATION.success })
  },

  info: (message) => {
    if (!message) return
    toast(message, { duration: DURATION.info })
  },

  itemDrop: (item_catalog) => {
    if (!item_catalog) return
    const { name, rarity, slot } = item_catalog
    toast(`⚔ ${name}`, {
      description: `${RARITY_LABELS[rarity] ?? rarity} · ${SLOT_LABELS[slot] ?? slot}`,
      duration:    DURATION.drop,
    })
  },

  tacticDrop: (tactic) => {
    if (!tactic) return
    const name = tactic.name ?? tactic
    toast(`🎯 ${name}`, {
      description: 'Nueva táctica obtenida',
      duration:    DURATION.drop,
    })
  },

  bagFull: () => {
    toast.warning('Mochila llena', {
      description: 'Un objeto ha sido descartado porque no hay espacio en el inventario.',
      duration:    DURATION.bagFull,
    })
  },
}
