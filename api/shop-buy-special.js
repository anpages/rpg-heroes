import { requireAuth } from './_auth.js'
import { getEffectiveStats } from './_stats.js'
import { isUUID, effectiveBagLimit } from './_validate.js'
import { xpRequiredForLevel } from '../src/lib/gameFormulas.js'

function tierForLevel(level) {
  if (level >= 26) return 3
  if (level >= 11) return 2
  return 1
}

export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { heroId, specialId } = req.body
  if (!heroId || !specialId) return res.status(400).json({ error: 'heroId y specialId requeridos' })
  if (!isUUID(heroId)) return res.status(400).json({ error: 'heroId inválido' })
  if (typeof specialId !== 'string' || specialId.length > 64) return res.status(400).json({ error: 'specialId inválido' })

  const dateStr = new Date().toISOString().slice(0, 10)

  const [
    { data: hero },
    { data: special },
    { data: alreadyBought },
  ] = await Promise.all([
    supabase.from('heroes')
      .select('id, player_id, level, experience, class, status, active_effects, current_hp, max_hp')
      .eq('id', heroId).eq('player_id', user.id).single(),
    supabase.from('shop_special_catalog').select('*').eq('id', specialId).maybeSingle(),
    supabase.from('hero_shop_special_purchases')
      .select('special_id').eq('hero_id', heroId).eq('special_id', specialId).eq('purchase_date', dateStr).maybeSingle(),
  ])

  if (!hero) return res.status(403).json({ error: 'No autorizado' })
  if (!special) return res.status(404).json({ error: 'Oferta no disponible' })
  if (alreadyBought) return res.status(409).json({ error: 'Ya compraste esta oferta hoy' })

  const { data: resources } = await supabase
    .from('resources').select('bag_extra_slots').eq('player_id', user.id).single()
  if (!resources) return res.status(500).json({ error: 'Sin recursos' })

  if (special.effect_type === 'repair_all' && hero.status === 'exploring') {
    return res.status(409).json({ error: 'El héroe está en expedición' })
  }

  let result = {}

  if (special.effect_type === 'xp_scroll') {
    let newXp = (hero.experience ?? 0) + (special.effect_value ?? 500)
    let newLevel = hero.level
    while (newXp >= xpRequiredForLevel(newLevel)) {
      newXp -= xpRequiredForLevel(newLevel)
      newLevel += 1
    }
    const { error } = await supabase.from('heroes')
      .update({ experience: newXp, level: newLevel })
      .eq('id', heroId)
    if (error) return res.status(500).json({ error: error.message })
    result = { xpGained: special.effect_value, newLevel, leveledUp: newLevel > hero.level }
  }
  else if (special.effect_type === 'full_heal') {
    const effStats = await getEffectiveStats(supabase, hero.id, user.id)
    const fullHp = effStats?.max_hp ?? hero.max_hp
    const { error } = await supabase.from('heroes')
      .update({ current_hp: fullHp, hp_last_updated_at: new Date().toISOString() })
      .eq('id', heroId)
    if (error) return res.status(500).json({ error: error.message })
    result = { healedTo: fullHp }
  }
  else if (special.effect_type === 'double_loot') {
    const effects = { ...(hero.active_effects ?? {}), loot_boost: 1 }
    const { error } = await supabase.from('heroes')
      .update({ active_effects: effects })
      .eq('id', heroId)
    if (error) return res.status(500).json({ error: error.message })
    result = { effect: 'loot_boost' }
  }
  else if (special.effect_type === 'repair_all') {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('id, current_durability, item_catalog(max_durability)')
      .eq('hero_id', heroId)
      .not('equipped_slot', 'is', null)
    const damaged = (items ?? []).filter(i => i.current_durability < i.item_catalog.max_durability)
    await Promise.all(damaged.map(i =>
      supabase.from('inventory_items')
        .update({ current_durability: i.item_catalog.max_durability })
        .eq('id', i.id)
    ))
    result = { repaired: damaged.length }
  }
  else if (special.effect_type === 'merchant_chest') {
    const tier = tierForLevel(hero.level)
    const rarity = Math.random() < 0.7 ? 'rare' : 'epic'
    let q = supabase.from('item_catalog')
      .select('id, max_durability, name, slot, tier, rarity')
      .eq('tier', tier).eq('rarity', rarity)
    q = hero.class
      ? q.or(`required_class.is.null,required_class.eq.${hero.class}`)
      : q.is('required_class', null)
    const { data: candidates } = await q
    if (!candidates?.length) return res.status(409).json({ error: 'No hay items disponibles para tu clase y tier' })

    const { count: bagCount } = await supabase
      .from('inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('hero_id', heroId).is('equipped_slot', null)
    if ((bagCount ?? 0) >= effectiveBagLimit(resources.bag_extra_slots)) {
      return res.status(409).json({ error: 'Inventario lleno' })
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)]
    const { data: newItem } = await supabase
      .from('inventory_items')
      .insert({ hero_id: heroId, catalog_id: picked.id, current_durability: picked.max_durability })
      .select('*, item_catalog(name, slot, tier, rarity)')
      .single()
    result = { item: newItem, rolled: { tier, rarity } }
  }
  else if (special.effect_type === 'gold_boost') {
    const effects = { ...(hero.active_effects ?? {}), gold_boost: (special.effect_value ?? 50) / 100 }
    const { error } = await supabase.from('heroes')
      .update({ active_effects: effects })
      .eq('id', heroId)
    if (error) return res.status(500).json({ error: error.message })
    result = { effect: 'gold_boost' }
  }
  else if (special.effect_type === 'fragments_grant') {
    const amount = special.effect_value ?? 10
    // Deducir oro y sumar fragmentos (atómico via RPCs)
    const { data: ok, error: rpcErr } = await supabase.rpc('deduct_resources', { p_player_id: user.id, p_gold: special.gold_price })
    if (rpcErr) return res.status(500).json({ error: rpcErr.message })
    if (!ok) return res.status(409).json({ error: 'Oro insuficiente' })
    await supabase.rpc('add_resources', { p_player_id: user.id, p_fragments: amount })
    await supabase.from('hero_shop_special_purchases')
      .insert({ hero_id: heroId, special_id: specialId, purchase_date: dateStr })
    return res.status(200).json({ ok: true, goldSpent: special.gold_price, effect: 'fragments_grant', fragmentsGained: amount })
  }
  else if (special.effect_type === 'training_boost') {
    const effects = { ...(hero.active_effects ?? {}), training_boost: 1 }
    const { error } = await supabase.from('heroes')
      .update({ active_effects: effects })
      .eq('id', heroId)
    if (error) return res.status(500).json({ error: error.message })
    result = { effect: 'training_boost' }
  }
  else if (special.effect_type === 'card_guaranteed') {
    const effects = { ...(hero.active_effects ?? {}), card_guaranteed: 1 }
    const { error } = await supabase.from('heroes')
      .update({ active_effects: effects })
      .eq('id', heroId)
    if (error) return res.status(500).json({ error: error.message })
    result = { effect: 'card_guaranteed' }
  }
  else if (special.effect_type === 'random_rune') {
    return res.status(409).json({ error: 'Este item ya no está disponible' })
  }
  else if (special.effect_type === 'free_repair') {
    const effects = { ...(hero.active_effects ?? {}), free_repair: 1 }
    const { error } = await supabase.from('heroes')
      .update({ active_effects: effects })
      .eq('id', heroId)
    if (error) return res.status(500).json({ error: error.message })
    result = { effect: 'free_repair' }
  }
  else {
    return res.status(400).json({ error: `Efecto desconocido: ${special.effect_type}` })
  }

  // Deducir oro (atómico via RPC)
  const { data: deductOk, error: resErr } = await supabase.rpc('deduct_resources', { p_player_id: user.id, p_gold: special.gold_price })
  if (resErr) return res.status(500).json({ error: resErr.message })
  if (!deductOk) return res.status(409).json({ error: 'Oro insuficiente' })

  await supabase.from('hero_shop_special_purchases')
    .insert({ hero_id: heroId, special_id: specialId, purchase_date: dateStr })

  return res.status(200).json({
    ok: true,
    goldSpent: special.gold_price,
    effect: special.effect_type,
    ...result,
  })
}
