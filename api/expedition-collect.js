import { createClient } from '@supabase/supabase-js'

const INVENTORY_BASE_LIMIT = 20
const INVENTORY_PER_WORKSHOP_LEVEL = 5
const DROP_CONFIG = [
  [1, 3,  0.20, [1],    [70, 25, 5,  0,  0]],
  [4, 6,  0.30, [1, 2], [50, 35, 12, 3,  0]],
  [7, 10, 0.40, [2, 3], [30, 35, 25, 8,  2]],
]
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const ALL_SLOTS = ['helmet', 'chest', 'arms', 'legs', 'feet', 'main_hand', 'off_hand', 'accessory']

async function rollItemDrop(supabase, heroId, playerId, dungeon) {
  const cfg = DROP_CONFIG.find(([mn, mx]) => dungeon.difficulty >= mn && dungeon.difficulty <= mx)
  if (!cfg) return null
  const [,, chance, tiers, weights] = cfg
  if (Math.random() > chance) return null

  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  let rarity = RARITIES[0]
  for (let i = 0; i < RARITIES.length; i++) { roll -= weights[i]; if (roll <= 0) { rarity = RARITIES[i]; break } }

  const tier = tiers[Math.floor(Math.random() * tiers.length)]
  const slot = ALL_SLOTS[Math.floor(Math.random() * ALL_SLOTS.length)]

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
    .from('dungeons').select('difficulty').eq('id', expedition.dungeon_id).single()

  const drop = dungeon ? await rollItemDrop(supabase, hero.id, user.id, dungeon) : null

  return res.status(200).json({
    ok: true,
    rewards: {
      gold: expedition.gold_earned,
      wood: expedition.wood_earned,
      mana: expedition.mana_earned,
      experience: expedition.experience_earned,
    },
    levelUp,
    drop: drop ?? null,
  })
}
