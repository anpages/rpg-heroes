/**
 * Lógica de drop de items y cartas compartida entre expediciones y torre.
 */

import { effectiveBagLimit } from './_validate.js'

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

// Probabilidad de drop y calidad según dificultad (1-10)
export function getDropConfig(difficulty) {
  const d = Math.max(1, Math.min(10, difficulty))
  const chance = 0.10 + d * 0.03                          // 13% dif1 → 40% dif10
  const tiers   = d <= 3 ? [1] : d <= 6 ? [1, 2] : [2, 3]
  const weights = [
    Math.max(0,  70 - d * 6),
    Math.max(0,  25 - d * 0.5),
    Math.min(40, d * 4),
    Math.min(25, Math.max(0, (d - 4) * 4)),
    Math.min(15, Math.max(0, (d - 7) * 5)),
  ]
  return { chance, tiers, weights }
}

// Pool de slots ponderados por tipo de contenido
const SLOT_POOL_BY_TYPE = {
  combat:     ['main_hand','main_hand','main_hand','off_hand','off_hand',
               'chest','arms','helmet','legs','accessory'],
  wilderness: ['legs','legs','arms','arms','accessory','accessory',
               'main_hand','off_hand','chest','helmet'],
  magic:      ['accessory','accessory','accessory','accessory',
               'helmet','chest','main_hand','off_hand','arms','legs'],
  crypt:      ['off_hand','off_hand','off_hand','chest','chest',
               'helmet','helmet','accessory','accessory','main_hand'],
  mine:       ['arms','arms','arms','chest','chest',
               'main_hand','main_hand','legs','helmet','off_hand'],
  ancient:    ['accessory','accessory','accessory','helmet','helmet',
               'chest','main_hand','off_hand','arms','legs'],
  // Para la torre los floors impares premian armas, los pares armaduras
  tower_odd:  ['main_hand','main_hand','off_hand','off_hand','accessory',
               'helmet','chest','arms','legs','accessory'],
  tower_even: ['chest','chest','helmet','helmet','arms',
               'legs','main_hand','off_hand','accessory','accessory'],
}

function pickSlot(poolKey) {
  const pool = SLOT_POOL_BY_TYPE[poolKey] ?? SLOT_POOL_BY_TYPE.combat
  return pool[Math.floor(Math.random() * pool.length)]
}


export async function rollItemDrop(supabase, heroId, playerId, { difficulty, poolKey, dropRateBonus = 0, dropRateMult = 1, heroClass = null }) {
  const { chance, tiers, weights } = getDropConfig(difficulty)
  if (Math.random() > (chance + dropRateBonus) * dropRateMult) return null

  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  let rarity = RARITIES[0]
  for (let i = 0; i < RARITIES.length; i++) { roll -= weights[i]; if (roll <= 0) { rarity = RARITIES[i]; break } }

  const tier = tiers[Math.floor(Math.random() * tiers.length)]
  const slot = pickSlot(poolKey)

  let query = supabase
    .from('item_catalog').select('id, max_durability').eq('slot', slot).eq('tier', tier).eq('rarity', rarity)

  // Items universales + items de la clase del héroe
  if (heroClass) {
    query = query.or(`required_class.is.null,required_class.eq.${heroClass}`)
  } else {
    query = query.is('required_class', null)
  }

  const { data: candidates } = await query
  if (!candidates?.length) return null


  const [{ count: bagCount }, { data: res }] = await Promise.all([
    supabase.from('inventory_items').select('id', { count: 'exact', head: true })
      .eq('hero_id', heroId).is('equipped_slot', null),
    supabase.from('resources').select('*').eq('player_id', playerId).single(),
  ])

  if ((bagCount ?? 0) >= effectiveBagLimit(res?.bag_extra_slots)) return { full: true }

  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  const { data: newItem } = await supabase
    .from('inventory_items')
    .insert({ hero_id: heroId, catalog_id: picked.id, current_durability: picked.max_durability })
    .select('*, item_catalog(name, slot, tier, rarity)')
    .single()
  return newItem
}

/**
 * Lanza el dado de drop de una táctica.
 * Si el héroe ya tiene la táctica, sube su nivel (+1, max 5).
 * Si ya está al máximo, compensa con oro.
 *
 * @param {object} supabase
 * @param {string} heroId
 * @param {string|null} heroClass
 * @param {{ chance: number, bonusChance?: number }} opts
 * @returns {object|null} { tactic, leveledUp, compensated, goldCompensation }
 */
export async function rollTacticDrop(supabase, heroId, heroClass, { chance = 0.08, bonusChance = 0 } = {}) {
  if (Math.random() > chance + bonusChance) return null

  // Elegir rareza del drop
  const weights = [40, 30, 20, 8, 2]
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  let rarity = RARITIES[0]
  for (let i = 0; i < RARITIES.length; i++) { roll -= weights[i]; if (roll <= 0) { rarity = RARITIES[i]; break } }

  // Buscar candidatos del catálogo
  let query = supabase.from('tactic_catalog').select('id, name, icon, category, rarity')
    .eq('rarity', rarity)
  if (heroClass) {
    query = query.or(`required_class.is.null,required_class.eq.${heroClass}`)
  } else {
    query = query.is('required_class', null)
  }
  const { data: candidates } = await query
  if (!candidates?.length) return null

  const picked = candidates[Math.floor(Math.random() * candidates.length)]

  // Comprobar si el héroe ya tiene esta táctica
  const { data: existing } = await supabase
    .from('hero_tactics')
    .select('id, level')
    .eq('hero_id', heroId)
    .eq('tactic_id', picked.id)
    .maybeSingle()

  if (existing) {
    if (existing.level >= 5) {
      // Máximo nivel: compensar con oro
      const goldComp = rarity === 'legendary' ? 500 : rarity === 'epic' ? 300 : rarity === 'rare' ? 150 : 75
      return { tactic: picked, leveledUp: false, compensated: true, goldCompensation: goldComp }
    }
    // Subir nivel
    await supabase.from('hero_tactics')
      .update({ level: existing.level + 1 })
      .eq('id', existing.id)
    return { tactic: picked, leveledUp: true, newLevel: existing.level + 1, compensated: false }
  }

  // Nueva táctica — insertar sin slot
  await supabase.from('hero_tactics')
    .insert({ hero_id: heroId, tactic_id: picked.id, level: 1, slot_index: null })
  return { tactic: picked, leveledUp: false, newLevel: 1, compensated: false, isNew: true }
}

/** Convierte un floor de torre en dificultad equivalente (1-10) */
export function floorToDifficulty(floor) {
  return Math.min(10, Math.max(1, Math.floor(floor / 2) + 1))
}

// Drops de materiales de crafting por nombre de dungeon.
// Guarida del Dragón / Ruinas Encantadas / Minas / Templo → drop
// Cueva de Goblins / Cripta de los Condenados / Bosque Oscuro → ninguno
const MATERIAL_DROP_BY_NAME = {
  'Mina Abandonada':          { resource: 'fragments', chance: 0.15, min: 1, max: 1 },
  'Cripta de los Condenados': { resource: 'fragments', chance: 0.20, min: 1, max: 2 },
  'Templo de los Antiguos':   { resource: 'essence',   chance: 0.18, min: 1, max: 2 },
  'Guarida del Dragón':       { resource: 'essence',   chance: 0.25, min: 2, max: 3 },
}

/** Lanza el dado de drop de material para una dungeon por nombre.
 *  @returns {{ resource: 'fragments'|'essence', qty: number } | null} */
export function rollMaterialDrop(dungeonName) {
  const cfg = MATERIAL_DROP_BY_NAME[dungeonName]
  if (!cfg || Math.random() > cfg.chance) return null
  const qty = cfg.min + Math.floor(Math.random() * (cfg.max - cfg.min + 1))
  return { resource: cfg.resource, qty }
}
