import { requireAuth } from './_auth.js'
import { isUUID, snapshotResources } from './_validate.js'
import { interpolateHP } from './_hp.js'
import { getEffectiveStats } from './_stats.js'
import {
  BOUNTY_SUCCESS_RATE,
  BOUNTY_CONSOLATION_FRAGMENTS,
  WEAR_PROFILE,
  bountyRarityWeightsForLevel,
} from '../src/lib/gameConstants.js'

/**
 * Resuelve una caza: tirada 40% éxito, rareza escalada al nivel, inserta el
 * ítem (o fragmentos de consuelo), aplica desgaste, libera el héroe.
 */
export default async function handler(req, res) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  const { user, supabase } = auth

  const { runId } = req.body
  if (!runId)         return res.status(400).json({ error: 'runId requerido' })
  if (!isUUID(runId)) return res.status(400).json({ error: 'runId inválido' })

  // Cargar run
  const { data: run } = await supabase
    .from('bounty_runs')
    .select('*')
    .eq('id', runId)
    .single()

  if (!run) return res.status(404).json({ error: 'Caza no encontrada' })
  if (run.status === 'completed') {
    return res.status(409).json({ error: 'Esta caza ya fue recogida' })
  }
  if (new Date(run.ends_at) > new Date()) {
    return res.status(409).json({ error: 'La caza aún no ha terminado' })
  }

  // Cargar héroe (con propiedad)
  const { data: hero } = await supabase
    .from('heroes')
    .select('id, player_id, level, class, current_hp, max_hp, hp_last_updated_at, status, status_ends_at')
    .eq('id', run.hero_id)
    .single()

  if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' })
  if (hero.player_id !== user.id) return res.status(403).json({ error: 'No autorizado' })

  // Tirada 40%
  const success = Math.random() < BOUNTY_SUCCESS_RATE

  let rarity = null
  let drop   = null
  let fragmentsGained = 0

  if (success) {
    // Elegir rareza según nivel
    const weights = bountyRarityWeightsForLevel(hero.level)
    rarity = pickWeightedRarity(weights)

    // Buscar candidato en catálogo: slot + rareza + tier 1 (caza no da T2/T3)
    // + filtro de clase (si el héroe tiene clase, admitir null o su clase)
    let q = supabase
      .from('item_catalog')
      .select('id, max_durability, name')
      .eq('slot', run.slot)
      .eq('rarity', rarity)
      .in('tier', [1, 2])   // consistente con cámaras — no T3

    if (hero.class) {
      q = q.or(`required_class.is.null,required_class.eq.${hero.class}`)
    } else {
      q = q.is('required_class', null)
    }

    const { data: candidates } = await q

    if (candidates && candidates.length > 0) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)]
      const { data: newItem } = await supabase
        .from('inventory_items')
        .insert({
          hero_id:            hero.id,
          catalog_id:         picked.id,
          current_durability: picked.max_durability,
        })
        .select('*, item_catalog(name, slot, tier, rarity)')
        .single()
      drop = newItem
    }
  } else {
    // Consuelo: fragmentos
    const min = BOUNTY_CONSOLATION_FRAGMENTS.min
    const max = BOUNTY_CONSOLATION_FRAGMENTS.max
    fragmentsGained = min + Math.floor(Math.random() * (max - min + 1))

    const { data: resources } = await supabase
      .from('resources')
      .select('gold, iron, wood, mana, fragments, gold_rate, iron_rate, wood_rate, mana_rate, last_collected_at')
      .eq('player_id', user.id)
      .single()

    if (resources) {
      const snap = snapshotResources(resources)
      await supabase
        .from('resources')
        .update({
          gold:              snap.gold,
          iron:              snap.iron,
          wood:              snap.wood,
          mana:              snap.mana,
          fragments:         (resources.fragments ?? 0) + fragmentsGained,
          last_collected_at: snap.nowIso,
        })
        .eq('player_id', user.id)
        .eq('last_collected_at', snap.prevCollectedAt)
    }
  }

  // Desgaste del equipo (escalado por rareza × slot)
  const wear = WEAR_PROFILE.bounty ?? 2
  if (wear > 0) {
    const { error: durError } = await supabase.rpc('reduce_equipment_durability_scaled', {
      p_hero_id: hero.id,
      amount:    wear,
    })
    if (durError) console.error('durability rpc error:', durError.message)
  }

  // Liberar al héroe: volver a idle, reanudar regen de HP
  const effStats = await getEffectiveStats(supabase, hero.id, user.id)
  const regeneratedHp = interpolateHP(hero, Date.now(), effStats?.max_hp)
  await supabase
    .from('heroes')
    .update({
      status:             'idle',
      current_hp:         regeneratedHp,
      hp_last_updated_at: new Date().toISOString(),
      status_ends_at:     null,
    })
    .eq('id', hero.id)

  // Cerrar run
  const result = { success, rarity, fragments: fragmentsGained, itemId: drop?.id ?? null }
  await supabase
    .from('bounty_runs')
    .update({
      status: 'completed',
      result,
    })
    .eq('id', run.id)

  return res.status(200).json({
    ok:       true,
    success,
    rarity,
    drop:     drop ?? null,
    fragments: fragmentsGained,
    slot:     run.slot,
  })
}

function pickWeightedRarity(weights) {
  const keys   = Object.keys(weights)
  const values = keys.map(k => weights[k])
  const total  = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return keys[0]
  let roll = Math.random() * total
  for (let i = 0; i < keys.length; i++) {
    roll -= values[i]
    if (roll <= 0) return keys[i]
  }
  return keys[keys.length - 1]
}
