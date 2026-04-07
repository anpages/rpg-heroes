/**
 * Toasts de drop de items y cartas.
 * Se muestran en bottom-right para distinguirlos de las notificaciones de acción.
 */
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

export function showItemDropToast(item_catalog) {
  if (!item_catalog) return
  const { name, rarity, slot } = item_catalog
  toast(`⚔ ${name}`, {
    description: `${RARITY_LABELS[rarity] ?? rarity} · ${SLOT_LABELS[slot] ?? slot}`,
    position:    'bottom-right',
    duration:    6000,
  })
}

export function showCardDropToast(skill_cards) {
  if (!skill_cards) return
  const name = skill_cards.name ?? skill_cards
  toast(`🃏 ${name}`, {
    description: 'Nueva carta obtenida',
    position:    'bottom-right',
    duration:    6000,
  })
}
