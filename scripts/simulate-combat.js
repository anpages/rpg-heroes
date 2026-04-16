/**
 * Simula 100 combates con el héroe Liora usando su estado actual de la DB.
 * Replica exactamente la lógica de api/quick-combat.js
 *
 * Uso: node scripts/simulate-combat.js
 */

import { createClient } from '@supabase/supabase-js'
import { simulateCombat } from '../api/_combat.js'
import { enemyStatsForLevel, CLASS_TO_ARCHETYPE } from '../src/lib/gameFormulas.js'
import { COMBAT_STRATEGIES } from '../src/lib/gameConstants.js'
import { generateCounterTactics } from '../api/_enemyTactics.js'
import { computeClassLevelBonuses } from '../src/lib/gameConstants.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan variables de entorno: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  console.error('Ejecuta: source .env.local && node scripts/simulate-combat.js')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const ARCHETYPES = ['berserker', 'tank', 'assassin', 'mage']
const ARCHETYPE_STRATEGY = { berserker: 'aggressive', assassin: 'aggressive', tank: 'defensive', mage: 'balanced' }

// ── Obtener stats efectivas del héroe (replica _stats.js) ─────────────────────
async function getEffectiveStats(heroId) {
  const [heroRes, itemsRes, tacticsRes] = await Promise.all([
    supabase.from('heroes')
      .select('attack, defense, strength, agility, intelligence, max_hp, class, class_level, level, name, current_hp, hp_last_updated_at, active_effects')
      .eq('id', heroId)
      .single(),
    supabase.from('inventory_items')
      .select('current_durability, equipped_slot, enchantments, item_catalog(attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus, weight, max_durability)')
      .eq('hero_id', heroId)
      .not('equipped_slot', 'is', null),
    supabase.from('hero_tactics')
      .select('level, tactic_catalog(name, icon, combat_effect, stat_bonuses)')
      .eq('hero_id', heroId)
      .not('slot_index', 'is', null),
  ])

  const hero = heroRes.data
  const stats = { ...hero }

  const classBonuses = computeClassLevelBonuses(hero.class, hero.class_level ?? 1)
  for (const [stat, val] of Object.entries(classBonuses)) {
    if (stat in stats) stats[stat] += val
  }

  let totalWeight = 0
  for (const item of itemsRes.data ?? []) {
    if (item.current_durability <= 0) continue
    const c = item.item_catalog
    totalWeight += c.weight ?? 0
    const durPct = c.max_durability > 0 ? item.current_durability / c.max_durability : 1
    stats.attack       += Math.round((c.attack_bonus       ?? 0) * durPct)
    stats.defense      += Math.round((c.defense_bonus      ?? 0) * durPct)
    stats.max_hp       += Math.round((c.hp_bonus           ?? 0) * durPct)
    stats.strength     += Math.round((c.strength_bonus     ?? 0) * durPct)
    stats.agility      += Math.round((c.agility_bonus      ?? 0) * durPct)
    stats.intelligence += Math.round((c.intelligence_bonus ?? 0) * durPct)
    const enc = item.enchantments ?? {}
    if (enc.attack_bonus)       stats.attack       += Math.round(enc.attack_bonus       * durPct)
    if (enc.defense_bonus)      stats.defense      += Math.round(enc.defense_bonus      * durPct)
    if (enc.hp_bonus)           stats.max_hp       += Math.round(enc.hp_bonus           * durPct)
    if (enc.strength_bonus)     stats.strength     += Math.round(enc.strength_bonus     * durPct)
    if (enc.agility_bonus)      stats.agility      += Math.round(enc.agility_bonus      * durPct)
    if (enc.intelligence_bonus) stats.intelligence += Math.round(enc.intelligence_bonus * durPct)
  }

  const STAT_MAP = { attack: 'attack', defense: 'defense', max_hp: 'max_hp', strength: 'strength', agility: 'agility', intelligence: 'intelligence' }
  for (const t of tacticsRes.data ?? []) {
    const cat = t.tactic_catalog
    for (const { stat, value } of cat?.stat_bonuses ?? []) {
      if (stat in STAT_MAP) stats[STAT_MAP[stat]] += Math.round((value ?? 0) * (t.level ?? 1))
    }
  }

  const weightPenalty = Math.floor(totalWeight / 4)
  stats.agility = Math.max(0, stats.agility - weightPenalty)

  const heroTactics = (tacticsRes.data ?? []).filter(r => r.tactic_catalog).map(r => ({
    name: r.tactic_catalog.name, icon: r.tactic_catalog.icon,
    level: r.level, combat_effect: r.tactic_catalog.combat_effect,
  }))

  return { stats, heroTactics, items: itemsRes.data ?? [] }
}

async function getFullStats(heroId) {
  const [heroRes, itemsRes] = await Promise.all([
    supabase.from('heroes').select('attack, defense, strength, agility, intelligence, max_hp').eq('id', heroId).single(),
    supabase.from('inventory_items')
      .select('current_durability, equipped_slot, enchantments, item_catalog(attack_bonus, defense_bonus, hp_bonus, strength_bonus, agility_bonus, intelligence_bonus, weight, max_durability)')
      .eq('hero_id', heroId)
      .not('equipped_slot', 'is', null),
  ])
  const stats = { ...heroRes.data }
  let totalWeight = 0
  for (const item of itemsRes.data ?? []) {
    if (item.current_durability <= 0) continue
    const c = item.item_catalog
    totalWeight += c.weight ?? 0
    stats.attack       += c.attack_bonus       ?? 0
    stats.defense      += c.defense_bonus      ?? 0
    stats.max_hp       += c.hp_bonus           ?? 0
    stats.strength     += c.strength_bonus     ?? 0
    stats.agility      += c.agility_bonus      ?? 0
    stats.intelligence += c.intelligence_bonus ?? 0
    const enc = item.enchantments ?? {}
    if (enc.attack_bonus)       stats.attack       += enc.attack_bonus
    if (enc.defense_bonus)      stats.defense      += enc.defense_bonus
    if (enc.hp_bonus)           stats.max_hp       += enc.hp_bonus
    if (enc.strength_bonus)     stats.strength     += enc.strength_bonus
    if (enc.agility_bonus)      stats.agility      += enc.agility_bonus
    if (enc.intelligence_bonus) stats.intelligence += enc.intelligence_bonus
  }
  const weightPenalty = Math.floor(totalWeight / 4)
  stats.agility = Math.max(0, stats.agility - weightPenalty)
  return stats
}

function avg(arr) { return arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0 }
function pct(n, total) { return ((n / total) * 100).toFixed(1) }

async function simulateHero(hero) {
  const { stats: heroStats, heroTactics, items } = await getEffectiveStats(hero.id)
  const fullStats = await getFullStats(hero.id)
  const vl = Math.max(1, Math.min(21, Math.ceil(hero.level * 21 / 50)))

  console.log(`\n═══════════════════════════════════════════════════════`)
  console.log(`  HÉROE: ${hero.name}  |  Nivel ${hero.level}  |  Clase: ${hero.class}`)
  console.log(`  Nivel de clase: ${hero.class_level ?? 1}  |  XP: ${hero.experience}  |  VL enemigos: ${vl}`)
  console.log(`═══════════════════════════════════════════════════════`)
  console.log(`Stats efectivas:  HP ${heroStats.max_hp}  ATQ ${heroStats.attack}  DEF ${heroStats.defense}  FUE ${heroStats.strength}  AGI ${heroStats.agility}  INT ${heroStats.intelligence}`)

  const equippedItems = items.filter(i => i.equipped_slot)
  if (equippedItems.length > 0) {
    const slots = equippedItems.map(i => {
      const dur = i.item_catalog.max_durability > 0 ? Math.round(i.current_durability / i.item_catalog.max_durability * 100) : 100
      return `${i.equipped_slot}(${dur}%)`
    }).join('  ')
    console.log(`Equipo:           ${slots}`)
  } else {
    console.log(`Equipo:           ninguno`)
  }

  if (heroTactics.length > 0) {
    console.log(`Tácticas:         ${heroTactics.map(t => `${t.icon}${t.name} nv.${t.level}`).join('  ')}`)
  }

  const results = {
    total: { wins: 0, losses: 0, rounds: [], hpLeftHero: [], hpLeftEnemy: [] },
    byArchetype: {},
  }
  for (const arch of ARCHETYPES) {
    results.byArchetype[arch] = { wins: 0, losses: 0, rounds: [], hpLeftHero: [], hpLeftEnemy: [], enemyMaxHp: 0 }
  }

  // Combate espejo: el enemigo es siempre de la misma clase que el héroe
  const archetypeKey = CLASS_TO_ARCHETYPE[hero.class] ?? 'tank'
  const enemyStrategyKey = ARCHETYPE_STRATEGY[archetypeKey] ?? 'balanced'
  const enemyStrategy = COMBAT_STRATEGIES[enemyStrategyKey]

  const N = 100
  for (let i = 0; i < N; i++) {
    const enemyStats = enemyStatsForLevel(hero.class, vl)
    enemyStats.attack  = Math.round(enemyStats.attack  * enemyStrategy.atkMult)
    enemyStats.defense = Math.round(enemyStats.defense * enemyStrategy.defMult)
    results.byArchetype[archetypeKey].enemyMaxHp = enemyStats.max_hp

    const enemyTactics = generateCounterTactics(vl, archetypeKey, heroStats)
    const r = simulateCombat(heroStats, enemyStats, {
      classA:   hero.class,
      classB:   hero.class,   // espejo
      tacticsA: heroTactics,
      tacticsB: enemyTactics,
    })

    const won = r.winner === 'a'
    const bin = results.byArchetype[archetypeKey]
    if (won) { bin.wins++; results.total.wins++ }
    else     { bin.losses++; results.total.losses++ }
    bin.rounds.push(r.rounds)
    bin.hpLeftHero.push(r.hpLeftA)
    bin.hpLeftEnemy.push(r.hpLeftB)
    results.total.rounds.push(r.rounds)
    results.total.hpLeftHero.push(r.hpLeftA)
    results.total.hpLeftEnemy.push(r.hpLeftB)
  }

  const b = results.byArchetype[archetypeKey]
  const bTotal = b.wins + b.losses
  const wr = pct(b.wins, bTotal)
  const bar = '█'.repeat(Math.round(b.wins / bTotal * 20)) + '░'.repeat(20 - Math.round(b.wins / bTotal * 20))
  const avgRounds  = avg(b.rounds).toFixed(1)
  const avgHpHero  = avg(b.hpLeftHero.map(hp => hp / heroStats.max_hp * 100)).toFixed(0)
  const avgHpEnemy = b.enemyMaxHp > 0 ? avg(b.hpLeftEnemy.map(hp => hp / b.enemyMaxHp * 100)).toFixed(0) : '?'

  console.log(`\n  Rival: ${hero.class} (arquetipo táctico: ${archetypeKey})`)
  console.log(`  [${bar}] ${wr}% victorias (${b.wins}/100)`)
  console.log(`  Rondas: ${avgRounds}  HP héroe: ${avgHpHero}%  HP enemigo: ${avgHpEnemy}%`)

  const roundDist = {}
  b.rounds.forEach(r => { roundDist[r] = (roundDist[r] ?? 0) + 1 })
  const distStr = Object.entries(roundDist).sort((a,b) => +a[0]-+b[0]).map(([r,c]) => `${r}r×${c}`).join('  ')
  console.log(`  Distribución: ${distStr}`)

  const winRate = b.wins / bTotal
  if (winRate > 0.75)      console.log(`\n  ⚠ Héroe demasiado fuerte (>75%)`)
  else if (winRate < 0.40) console.log(`\n  ⚠ Héroe demasiado débil (<40%)`)
  else                     console.log(`\n  ✓ Balance correcto (40-75%)`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
const { data: heroes } = await supabase.from('heroes').select('*').order('level', { ascending: false })
if (!heroes?.length) { console.error('No se encontraron héroes'); process.exit(1) }

console.log(`\nSimulando 100 combates para ${heroes.length} héroe(s) (combate espejo — misma clase)...\n`)

for (const hero of heroes) {
  await simulateHero(hero)
}
console.log(`\n═══════════════════════════════════════════════════════\n`)
