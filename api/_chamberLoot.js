/**
 * Generación de cofres para Cámaras.
 *
 * A diferencia de _loot.js (expediciones), aquí NO insertamos nada en BD durante
 * el "preview". Solo se calculan los 3 cofres como objetos serializables, se
 * firman con HMAC y el cliente ve el contenido antes de elegir. La aplicación
 * real (insert de items, suma de oro/xp/fragmentos) ocurre solo cuando
 * el jugador llama a chamber-confirm con el token + el índice del cofre elegido.
 *
 * Esto garantiza:
 *   • el cliente no puede manipular las cantidades (firma HMAC)
 *   • si el cliente abandona sin elegir, no se ha tocado nada
 *   • cada llamada a chamber-collect rerollea — no hay re-rollers gratis porque
 *     cada llamada gasta el HP que ya pagaste al iniciar la cámara
 *
 * Mecánica clave: cada cámara genera 3 cofres del MISMO arquetipo (su perfil
 * exclusivo). La elección de cámara decide QUÉ tipo de loot puede dropear
 * (mercader = cualquiera, erudito = solo armadura, cazador = solo armas).
 * Las cámaras NUNCA dan cartas (eso es exclusivo de expediciones).
 */

import {
  CHAMBER_CHEST_REWARDS,
  CHAMBER_CHEST_COUNT,
  CHAMBER_ITEM_SLOTS,
  CHAMBER_FRAGMENT_MIN_DIFFICULTY,
  chamberBaseReward,
} from '../src/lib/gameConstants.js'

// ── Varianza por cofre ───────────────────────────────────────────────────────
// Los cofres visibles aplican una varianza pequeña a oro/xp para que los 2
// cofres del arquetipo nunca salgan idénticos numéricamente.
// El cofre misterioso usa varianza mucho más amplia (boom or bust) y un
// multiplicador a la probabilidad de fragmento — pero NUNCA toca itemChance,
// para no romper la economía de drops respecto a expediciones.
const VISIBLE_GOLD_XP_VARIANCE  = 0.15
const MYSTERY_GOLD_XP_VARIANCE  = 0.35
const MYSTERY_FRAGMENT_CHANCE_MULT = 1.5

function rollWithVariance(base, variancePct) {
  const factor = 1 + (Math.random() * 2 - 1) * variancePct
  return Math.max(0, Math.round(base * factor))
}

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

function rollFragments(cfg) {
  const min = cfg.fragmentMin ?? 1
  const max = cfg.fragmentMax ?? min
  const qty = min + Math.floor(Math.random() * (max - min + 1))
  return { resource: 'fragments', qty }
}

/**
 * Rolea un único cofre, ya sea visible o misterioso.
 *
 * Visible: varianza estrecha (±15%) en oro/xp; el resto de probabilidades
 * son las del arquetipo tal cual.
 * Misterioso: varianza amplia (±35%) en oro/xp y multiplicador ×1.5 a la
 * probabilidad de fragmento (sigue gateado por dificultad). itemChance
 * sin tocar — la economía de items intacta respecto a expediciones.
 */
function rollSingleChest(chamberType, difficulty, isMystery, lootBoost = 0) {
  const cfg = CHAMBER_CHEST_REWARDS[chamberType]
  const base = chamberBaseReward(difficulty)
  const weights = chamberRarityWeights(difficulty)
  const fragmentsAllowed = difficulty >= CHAMBER_FRAGMENT_MIN_DIFFICULTY

  const variance = isMystery ? MYSTERY_GOLD_XP_VARIANCE : VISIBLE_GOLD_XP_VARIANCE
  const fragmentChance = isMystery
    ? cfg.fragmentChance * MYSTERY_FRAGMENT_CHANCE_MULT
    : cfg.fragmentChance

  const gold = rollWithVariance(base.gold * cfg.goldMult, variance)
  const xp   = rollWithVariance(base.xp   * cfg.xpMult,   variance)

  const material = fragmentsAllowed && Math.random() < fragmentChance
    ? rollFragments(cfg)
    : null
  const itemChance = Math.min(1, cfg.itemChance * (1 + lootBoost))
  const itemHint = Math.random() < itemChance
    ? { rarity: pickWeighted(RARITIES, weights) }
    : null

  return { archetype: chamberType, gold, xp, material, itemHint, mystery: isMystery }
}

/**
 * Genera la PREVIEW de los CHAMBER_CHEST_COUNT cofres de una cámara.
 *
 * Estructura: 2 cofres visibles del arquetipo + 1 cofre misterioso. La
 * posición del misterioso es ALEATORIA (no siempre el último) para que
 * el jugador no pueda inferir cuál es por el orden.
 *
 * El contenido del misterioso SÍ se rolea aquí y se incluye en el token
 * firmado — simplemente el cliente no lo muestra hasta que el jugador lo
 * elige. No es posible tramposar porque la firma HMAC ya cubre el array
 * completo.
 *
 * Cada cofre incluye:
 *   - archetype: tipo de la cámara
 *   - gold, xp: cantidades enteras (ya escaladas y con varianza aplicada)
 *   - material: { resource:'fragments', qty } | null
 *   - itemHint: { rarity } | null   — el item real se rolea en confirm
 *   - mystery: boolean              — flag para que la UI oculte el contenido
 */
export function rollChamberChests(chamberType, difficulty, lootBoost = 0) {
  const cfg = CHAMBER_CHEST_REWARDS[chamberType]
  if (!cfg) throw new Error(`chamberType inválido: ${chamberType}`)

  const mysteryIndex = Math.floor(Math.random() * CHAMBER_CHEST_COUNT)
  return Array.from({ length: CHAMBER_CHEST_COUNT }, (_, i) =>
    rollSingleChest(chamberType, difficulty, i === mysteryIndex, lootBoost),
  )
}

/**
 * Aplica la elección de cofre: rolea el item concreto (con filtro de clase y
 * slots permitidos para el tipo de cámara), lo inserta en la BD del héroe y
 * devuelve el objeto creado. El oro/xp/material los aplica chamber-confirm
 * directamente (necesita escribir resources).
 *
 * Las cámaras NO dan cartas, así que aquí solo manejamos itemHint.
 */
export async function applyChamberChestLoot(supabase, hero, chest) {
  const result = { drop: null }

  if (!chest.itemHint) return result

  const slotPool = CHAMBER_ITEM_SLOTS[chest.archetype] ?? []
  if (slotPool.length === 0) return result

  const slot = slotPool[Math.floor(Math.random() * slotPool.length)]
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
  if (!candidates?.length) return result

  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  const { data: newItem } = await supabase
    .from('inventory_items')
    .insert({ hero_id: hero.id, catalog_id: picked.id, current_durability: picked.max_durability })
    .select('*, item_catalog(name, slot, tier, rarity)')
    .single()
  result.drop = newItem

  return result
}
