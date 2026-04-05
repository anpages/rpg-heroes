/**
 * Lógica de drop de items y cartas compartida entre expediciones y torre.
 */

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

const CARD_DROP_BY_TYPE = {
  magic:   { chance: 0.35, categoryPool: ['intelligence','intelligence','intelligence','strength','agility'],   weights: [50,30,15,4,1] },
  ancient: { chance: 0.25, categoryPool: ['intelligence','strength','agility'],                                weights: [40,30,20,8,2] },
}

export async function rollItemDrop(supabase, heroId, playerId, { difficulty, poolKey }) {
  const { chance, tiers, weights } = getDropConfig(difficulty)
  if (Math.random() > chance) return null

  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  let rarity = RARITIES[0]
  for (let i = 0; i < RARITIES.length; i++) { roll -= weights[i]; if (roll <= 0) { rarity = RARITIES[i]; break } }

  const tier = tiers[Math.floor(Math.random() * tiers.length)]
  const slot = pickSlot(poolKey)

  const { data: candidates } = await supabase
    .from('item_catalog').select('id, max_durability').eq('slot', slot).eq('tier', tier).eq('rarity', rarity)
  if (!candidates?.length) return null

  const INVENTORY_BASE_LIMIT = 20
  const INVENTORY_PER_WORKSHOP_LEVEL = 5

  const { count: bagCount } = await supabase
    .from('inventory_items').select('id', { count: 'exact', head: true })
    .eq('hero_id', heroId).is('equipped_slot', null)

  const { data: workshop } = await supabase
    .from('buildings').select('level').eq('player_id', playerId).eq('type', 'workshop').maybeSingle()

  const limit = INVENTORY_BASE_LIMIT + ((workshop?.level ?? 1) - 1) * INVENTORY_PER_WORKSHOP_LEVEL
  if ((bagCount ?? 0) >= limit) return { full: true }

  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  const { data: newItem } = await supabase
    .from('inventory_items')
    .insert({ hero_id: heroId, catalog_id: picked.id, current_durability: picked.max_durability })
    .select('*, item_catalog(name, slot, tier, rarity)')
    .single()
  return newItem
}

export async function rollCardDrop(supabase, heroId, dungeonType, intelligenceBonus = 0) {
  const cfg = CARD_DROP_BY_TYPE[dungeonType]
  if (!cfg || Math.random() > cfg.chance + intelligenceBonus) return null

  const category = cfg.categoryPool[Math.floor(Math.random() * cfg.categoryPool.length)]
  const intShift = intelligenceBonus * 100
  const adjustedWeights = cfg.weights.map((w, i) => Math.max(0, w + (i - 1) * intShift))
  const total = adjustedWeights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  let rarity = RARITIES[0]
  for (let i = 0; i < RARITIES.length; i++) { roll -= adjustedWeights[i]; if (roll <= 0) { rarity = RARITIES[i]; break } }

  const { data: candidates } = await supabase
    .from('skill_cards').select('id').eq('category', category).eq('rarity', rarity)
  if (!candidates?.length) return null

  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  const { data: newCard } = await supabase
    .from('hero_cards')
    .insert({ hero_id: heroId, card_id: picked.id, rank: 1, equipped: false })
    .select('*, skill_cards(name, category, rarity)')
    .single()
  return newCard
}

/** Convierte un floor de torre en dificultad equivalente (1-10) */
export function floorToDifficulty(floor) {
  return Math.min(10, Math.max(1, Math.floor(floor / 2) + 1))
}
