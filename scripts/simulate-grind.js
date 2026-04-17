/**
 * Simulación de 100 combates de grindeo por héroe.
 * Lee héroes de la BD, simula combates sin escribir nada, reporta estadísticas.
 *
 * Uso: node scripts/simulate-grind.js
 */

import { createClient } from '@supabase/supabase-js'
import { simulateCombat, floorEnemyName } from '../api/_combat.js'
import { getEffectiveStats } from '../api/_stats.js'
import { generateEnemyTactics } from '../api/_enemyTactics.js'
import { COMBAT_HP_COST } from '../src/lib/gameConstants.js'

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL     ?? process.env.SUPABASE_URL
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('Faltan variables de entorno: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

const COMBATS    = 100
const FRAG_RATE  = 0.15
const ITEM_RATE  = 0.06

function enemyStatsFromHero(heroStats, scale = 0.85) {
  return {
    max_hp:       Math.max(1, Math.round(heroStats.max_hp       * scale)),
    attack:       Math.max(1, Math.round(heroStats.attack       * scale)),
    defense:      Math.max(1, Math.round(heroStats.defense      * scale)),
    strength:     Math.max(1, Math.round(heroStats.strength     * scale)),
    agility:      Math.max(1, Math.round(heroStats.agility      * scale)),
    intelligence: Math.max(1, Math.round(heroStats.intelligence * scale)),
  }
}

function rollRewards(won) {
  const gold = won
    ? 20 + Math.floor(Math.random() * 21)
    : 5  + Math.floor(Math.random() * 8)
  const xp = won
    ? 30 + Math.floor(Math.random() * 21)
    : 10 + Math.floor(Math.random() * 11)
  const fragments = (won && Math.random() < FRAG_RATE) ? 1 + Math.floor(Math.random() * 3) : 0
  const item      = won && Math.random() < ITEM_RATE
  return { gold, xp, fragments, item }
}

async function simulateHero(hero) {
  const heroStats = await getEffectiveStats(supabase, hero.id, hero.player_id)
  if (!heroStats) return null

  const { data: tacticRows } = await supabase
    .from('hero_tactics')
    .select('level, tactic_catalog(name, icon, combat_effect)')
    .eq('hero_id', hero.id)
    .not('slot_index', 'is', null)

  const heroTactics = (tacticRows ?? []).filter(r => r.tactic_catalog).map(r => ({
    name:          r.tactic_catalog.name,
    icon:          r.tactic_catalog.icon,
    level:         r.level,
    combat_effect: r.tactic_catalog.combat_effect,
  }))

  const vFloor    = Math.max(1, hero.level)
  const vTactics  = Math.min(21, hero.level * 3)
  const enemyStats = enemyStatsFromHero(heroStats, 1.0)

  let wins = 0, losses = 0
  let totalGold = 0, totalXp = 0, totalFrags = 0, totalItems = 0
  let totalHpSpent = 0
  let roundsTotal = 0

  for (let i = 0; i < COMBATS; i++) {
    const enemyTactics = generateEnemyTactics(vTactics, hero.class)

    const result = simulateCombat(heroStats, enemyStats, {
      classA:   hero.class,
      classB:   hero.class,
      tacticsA: heroTactics,
      tacticsB: enemyTactics,
    })

    const won = result.winner === 'a'
    won ? wins++ : losses++
    roundsTotal += result.rounds ?? 0

    const costPct = won ? COMBAT_HP_COST.grind.win : COMBAT_HP_COST.grind.loss
    totalHpSpent += Math.round(heroStats.max_hp * costPct)

    const r = rollRewards(won)
    totalGold  += r.gold
    totalXp    += r.xp
    totalFrags += r.fragments
    if (r.item) totalItems++
  }

  return {
    hero,
    heroStats,
    heroTactics: heroTactics.length,
    vFloor,
    wins,
    losses,
    winRate:      ((wins / COMBATS) * 100).toFixed(1),
    avgRounds:    (roundsTotal / COMBATS).toFixed(1),
    totalGold,
    totalXp,
    totalFrags,
    totalItems,
    avgGold:      (totalGold  / COMBATS).toFixed(1),
    avgXp:        (totalXp    / COMBATS).toFixed(1),
    avgFrags:     (totalFrags / COMBATS).toFixed(2),
    itemsEvery:   totalItems > 0 ? (COMBATS / totalItems).toFixed(1) : '∞',
    totalHpSpent,
    potionsNeeded: Math.ceil(totalHpSpent / (heroStats.max_hp * 0.40)),
  }
}

function bar(pct, width = 20) {
  const filled = Math.round((pct / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

async function main() {
  console.log('\n🎲  Simulación Grindeo — %d combates por héroe\n', COMBATS)

  const { data: heroes, error } = await supabase
    .from('heroes')
    .select('id, name, class, level, max_hp, current_hp, player_id, status')
    .order('level', { ascending: false })

  if (error) { console.error('Error fetching heroes:', error.message); process.exit(1) }
  if (!heroes?.length) { console.log('No hay héroes en la BD.'); process.exit(0) }

  console.log(`Héroes encontrados: ${heroes.length}\n`)

  const results = []

  for (const hero of heroes) {
    process.stdout.write(`  Simulando ${hero.name} (${hero.class} Nv.${hero.level})... `)
    const res = await simulateHero(hero)
    if (!res) { console.log('⚠ sin stats, saltando'); continue }
    results.push(res)
    console.log(`✓  winrate ${res.winRate}%`)
  }

  console.log('\n' + '═'.repeat(72))
  console.log('  RESULTADOS DETALLADOS')
  console.log('═'.repeat(72))

  for (const r of results) {
    const winPct = parseFloat(r.winRate)
    const alert  = winPct > 75 ? ' ⚠ MUY FÁCIL' : winPct < 35 ? ' ⚠ MUY DIFÍCIL' : ''

    console.log(`\n  ${r.hero.name}  [${r.hero.class} · Nv.${r.hero.level} · piso virtual ${r.vFloor}]${alert}`)
    console.log(`  HP: ${r.heroStats.max_hp} · ATQ: ${r.heroStats.attack} · DEF: ${r.heroStats.defense} · Tácticas equipadas: ${r.heroTactics}`)
    console.log(`  Victorias  ${r.wins.toString().padStart(3)}/${COMBATS}  ${bar(winPct)}  ${r.winRate}%`)
    console.log(`  Rondas/combate: ${r.avgRounds}  |  HP gastado total: ${r.totalHpSpent}  |  Pociones estimadas: ${r.potionsNeeded}`)
    console.log(`  Recompensas por combate: ${r.avgGold} oro · ${r.avgXp} XP · ${r.avgFrags} frags`)
    console.log(`  Items en ${r.totalItems}/${COMBATS} combates  (1 cada ~${r.itemsEvery} combates)`)
    console.log(`  Total ${COMBATS} combates: ${r.totalGold} oro · ${r.totalXp} XP · ${r.totalFrags} frags · ${r.totalItems} ítems`)
  }

  // Resumen por clase
  const byClass = {}
  for (const r of results) {
    const c = r.hero.class
    if (!byClass[c]) byClass[c] = { wins: 0, total: 0, count: 0 }
    byClass[c].wins  += r.wins
    byClass[c].total += COMBATS
    byClass[c].count++
  }

  console.log('\n' + '═'.repeat(72))
  console.log('  WINRATE MEDIO POR CLASE')
  console.log('═'.repeat(72))
  for (const [cls, d] of Object.entries(byClass)) {
    const pct = ((d.wins / d.total) * 100).toFixed(1)
    console.log(`  ${cls.padEnd(12)} ${bar(parseFloat(pct), 24)}  ${pct}%  (${d.count} héroe${d.count > 1 ? 's' : ''})`)
  }

  console.log('\n' + '═'.repeat(72))
  console.log('  NOTAS DE BALANCE')
  console.log('  · Objetivo winrate: 45-65% (combate desafiante pero ganable)')
  console.log('  · Frags objetivo: ~0.15/combate (15% × avg 1-3 frags)')
  console.log(`  · Drop rate ítems: ${(ITEM_RATE * 100).toFixed(0)}%  (~1 ítem cada ${(1/ITEM_RATE).toFixed(0)} combates)`)
  console.log('═'.repeat(72) + '\n')
}

main().catch(e => { console.error(e); process.exit(1) })
