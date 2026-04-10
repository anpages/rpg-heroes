/**
 * Generación de cofres para Cámaras.
 *
 * A diferencia de _loot.js (expediciones), aquí NO insertamos nada en BD durante
 * el "preview". Solo se calculan los 3 cofres como objetos serializables, se
 * firman con HMAC y el cliente ve el contenido antes de elegir. La aplicación
 * real (insert de items/cartas, suma de oro/xp/material) ocurre solo cuando
 * el jugador llama a chamber-confirm con el token + el cofre elegido.
 *
 * Esto garantiza:
 *   • el cliente no puede manipular las cantidades (firma HMAC)
 *   • si el cliente abandona sin elegir, no se ha tocado nada
 *   • cada llamada a chamber-collect rerollea — no hay re-rollers gratis porque
 *     cada llamada gasta el HP que ya pagaste al iniciar la cámara
 */

import { CHAMBER_CHEST_REWARDS, chamberBaseReward } from '../src/lib/gameConstants.js'

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

// Pesos de rareza por dificultad — más conservadores que las expediciones
function chamberRarityWeights(difficulty) {
  const d = Math.max(1, Math.min(10, difficulty))
  return [
    Math.max(0,  85 - d * 6),   // common
    Math.max(0,  20 - d * 0.4), // uncommon
    Math.min(20, d * 2),        // rare
    Math.min(8,  Math.max(0, (d - 5) * 2)),  // epic
    Math.min(3,  Math.max(0, (d - 8) * 2)),  // legendary
  ]
}

function pickWeighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return items[0]
  let roll = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

function rollMaterial() {
  // Las cámaras solo dan fragmentos (recurso común). La esencia queda
  // como exclusiva de las dungeons mágicas/dragón.
  return { resource: 'fragments', qty: 1 + Math.floor(Math.random() * 2) }
}

/**
 * Genera la PREVIEW de los 3 cofres de una cámara.
 * Cada cofre incluye:
 *   - archetype: 'mercader' | 'erudito' | 'cazador'
 *   - gold, xp: cantidades fijas (entero, ya escaladas)
 *   - material: { resource, qty } | null
 *   - itemHint: { rarity } | null   — el item real se rolea en confirm
 *   - cardHint: { rarity } | null   — la carta real se rolea en confirm
 *
 * Devuelve un objeto serializable que se firma con HMAC. Los hints solo
 * indican qué rarezas se sortearon — el item/carta concreto se elige al
 * confirmar (filtrando por clase del héroe entonces, no ahora).
 */
export function rollChamberChests(difficulty) {
  const base = chamberBaseReward(difficulty)
  const weights = chamberRarityWeights(difficulty)
  const archetypes = ['mercader', 'erudito', 'cazador']

  return archetypes.map(archetype => {
    const cfg = CHAMBER_CHEST_REWARDS[archetype]
    const gold = Math.round(base.gold * cfg.goldMult)
    const xp   = Math.round(base.xp   * cfg.xpMult)

    const material = Math.random() < cfg.materialChance ? rollMaterial() : null
    const itemHint = Math.random() < cfg.itemChance
      ? { rarity: pickWeighted(RARITIES, weights) }
      : null
    const cardHint = Math.random() < cfg.cardChance
      ? { rarity: pickWeighted(RARITIES, weights) }
      : null

    return { archetype, gold, xp, material, itemHint, cardHint }
  })
}

// Slots aleatorios para items de cámara — más equilibrado que el pool de expediciones
const CHAMBER_SLOTS = ['main_hand', 'off_hand', 'helmet', 'chest', 'arms', 'legs', 'accessory']

/**
 * Aplica la elección de cofre: rolea el item/carta concretos (con filtro de clase),
 * los inserta en la BD del héroe y devuelve los objetos creados. El oro/xp/material
 * los aplica el endpoint chamber-confirm directamente (necesita escribir resources).
 */
export async function applyChamberChestLoot(supabase, hero, chest) {
  const result = { drop: null, cardDrop: null }

  if (chest.itemHint) {
    const slot = CHAMBER_SLOTS[Math.floor(Math.random() * CHAMBER_SLOTS.length)]
    let q = supabase
      .from('item_catalog')
      .select('id, max_durability')
      .eq('slot', slot)
      .eq('rarity', chest.itemHint.rarity)
      // Tier 1 o 2: las cámaras nunca dan tier 3 (eso es exclusivo de expediciones difíciles)
      .in('tier', [1, 2])

    if (hero.class) {
      q = q.or(`required_class.is.null,required_class.eq.${hero.class}`)
    } else {
      q = q.is('required_class', null)
    }

    const { data: candidates } = await q
    if (candidates?.length) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)]
      const { data: newItem } = await supabase
        .from('inventory_items')
        .insert({ hero_id: hero.id, catalog_id: picked.id, current_durability: picked.max_durability })
        .select('*, item_catalog(name, slot, tier, rarity)')
        .single()
      result.drop = newItem
    }
  }

  if (chest.cardHint) {
    // Las cámaras solo dan cartas universales o de la clase — sin filtro de tipo de dungeon
    let cq = supabase
      .from('skill_cards')
      .select('id')
      .eq('rarity', chest.cardHint.rarity)
    if (hero.class) {
      cq = cq.or(`required_class.is.null,required_class.eq.${hero.class}`)
    }
    const { data: candidates } = await cq
    if (candidates?.length) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)]
      const { data: newCard } = await supabase
        .from('hero_cards')
        .insert({ hero_id: hero.id, card_id: picked.id, rank: 1, slot_index: null })
        .select('*, skill_cards(name, card_category, rarity)')
        .single()
      result.cardDrop = newCard
    }
  }

  return result
}
