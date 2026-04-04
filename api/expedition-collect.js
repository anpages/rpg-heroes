import { createClient } from '@supabase/supabase-js'

const INVENTORY_BASE_LIMIT = 20
const INVENTORY_PER_WORKSHOP_LEVEL = 5
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

// Probabilidad de drop y calidad según dificultad (1-10)
function getDropConfig(difficulty) {
  const d = Math.max(1, Math.min(10, difficulty))
  const chance = 0.10 + d * 0.03                          // 13% dif1 → 40% dif10
  const tiers   = d <= 3 ? [1] : d <= 6 ? [1, 2] : [2, 3]
  // Pesos rareza: cuanto mayor dificultad, más hacia rare/epic/legendary
  const weights = [
    Math.max(0,  70 - d * 6),   // common
    Math.max(0,  25 - d * 0.5), // uncommon
    Math.min(40, d * 4),        // rare
    Math.min(25, Math.max(0, (d - 4) * 4)), // epic
    Math.min(15, Math.max(0, (d - 7) * 5)), // legendary
  ]
  return { chance, tiers, weights }
}

// Pool de slots ponderados por tipo de mazmorra
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
}

function pickSlot(dungeonType) {
  const pool = SLOT_POOL_BY_TYPE[dungeonType] ?? SLOT_POOL_BY_TYPE.combat
  return pool[Math.floor(Math.random() * pool.length)]
}

// Drops de cartas para mazmorras magic y ancient
const CARD_DROP = {
  magic:   { chance: 0.35, categoryPool: ['intelligence','intelligence','intelligence','strength','agility'],   weights: [50,30,15,4,1] },
  ancient: { chance: 0.25, categoryPool: ['intelligence','strength','agility'],                                weights: [40,30,20,8,2] },
}

async function rollCardDrop(supabase, heroId, dungeon) {
  const cfg = CARD_DROP[dungeon.type]
  if (!cfg || Math.random() > cfg.chance) return null

  const category = cfg.categoryPool[Math.floor(Math.random() * cfg.categoryPool.length)]
  const total = cfg.weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  let rarity = RARITIES[0]
  for (let i = 0; i < RARITIES.length; i++) { roll -= cfg.weights[i]; if (roll <= 0) { rarity = RARITIES[i]; break } }

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

async function rollItemDrop(supabase, heroId, playerId, dungeon) {
  const { chance, tiers, weights } = getDropConfig(dungeon.difficulty)
  if (Math.random() > chance) return null

  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  let rarity = RARITIES[0]
  for (let i = 0; i < RARITIES.length; i++) { roll -= weights[i]; if (roll <= 0) { rarity = RARITIES[i]; break } }

  const tier = tiers[Math.floor(Math.random() * tiers.length)]
  const slot = pickSlot(dungeon.type)

  const { data: candidates } = await supabase
    .from('item_catalog').select('id, max_durability').eq('slot', slot).eq('tier', tier).eq('rarity', rarity)
  if (!candidates?.length) return null

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { expeditionId } = req.body
  if (!expeditionId) return res.status(400).json({ error: 'expeditionId requerido' })

  // Obtener expedición
  const { data: expedition, error: expError } = await supabase
    .from('expeditions')
    .select('*')
    .eq('id', expeditionId)
    .single()

  if (expError || !expedition) return res.status(404).json({ error: 'Expedición no encontrada' })
  if (new Date(expedition.ends_at) > new Date()) return res.status(409).json({ error: 'La expedición aún no ha terminado' })
  if (expedition.status === 'completed') return res.status(409).json({ error: 'Las recompensas ya fueron recogidas' })

  // Obtener héroe y verificar que pertenece al usuario
  const { data: hero, error: heroError } = await supabase
    .from('heroes')
    .select('id, player_id, experience, level')
    .eq('id', expedition.hero_id)
    .single()

  if (heroError || !hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // Obtener recursos actuales
  const { data: resources, error: resourcesError } = await supabase
    .from('resources')
    .select('gold, wood, mana')
    .eq('player_id', user.id)
    .single()

  if (resourcesError || !resources) return res.status(404).json({ error: 'Recursos no encontrados' })

  // Añadir recursos
  const { error: updateResourcesError } = await supabase
    .from('resources')
    .update({
      gold: resources.gold + (expedition.gold_earned ?? 0),
      wood: resources.wood + (expedition.wood_earned ?? 0),
      mana: resources.mana + (expedition.mana_earned ?? 0),
      last_collected_at: new Date().toISOString(),
    })
    .eq('player_id', user.id)

  if (updateResourcesError) return res.status(500).json({ error: updateResourcesError.message })

  // Añadir XP y subir nivel si corresponde
  const newXp = hero.experience + (expedition.experience_earned ?? 0)
  const xpForLevel = hero.level * 150
  const levelUp = newXp >= xpForLevel

  const { error: updateHeroError } = await supabase
    .from('heroes')
    .update({
      status: 'idle',
      experience: levelUp ? newXp - xpForLevel : newXp,
      level: levelUp ? hero.level + 1 : hero.level,
    })
    .eq('id', hero.id)

  if (updateHeroError) return res.status(500).json({ error: updateHeroError.message })

  // Marcar expedición como completada
  await supabase
    .from('expeditions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', expeditionId)

  // Reducir durabilidad del equipo equipado (−5 por expedición)
  await supabase.rpc('reduce_equipment_durability', { p_hero_id: hero.id, amount: 5 })

  // Obtener dungeon para el drop
  const { data: dungeon } = await supabase
    .from('dungeons').select('difficulty, type').eq('id', expedition.dungeon_id).single()

  const drop     = dungeon ? await rollItemDrop(supabase, hero.id, user.id, dungeon) : null
  const cardDrop = dungeon ? await rollCardDrop(supabase, hero.id, dungeon)          : null

  return res.status(200).json({
    ok: true,
    rewards: {
      gold: expedition.gold_earned,
      wood: expedition.wood_earned,
      mana: expedition.mana_earned,
      experience: expedition.experience_earned,
    },
    levelUp,
    drop:     drop     ?? null,
    cardDrop: cardDrop ?? null,
  })
}
