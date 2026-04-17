/**
 * Simulación completa de grindeo — winrate, drops, calidad de ítems.
 * Uso: node scripts/simulate-grind.js
 */

import { createClient } from '@supabase/supabase-js'
import { simulateCombat } from '../api/_combat.js'
import { getEffectiveStats } from '../api/_stats.js'
import { generateEnemyTactics } from '../api/_enemyTactics.js'
import { COMBAT_HP_COST } from '../src/lib/gameConstants.js'

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE) { console.error('Faltan variables de entorno'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
const COMBATS  = 2000

// ── Lógica espejo de grind-combat.js (sin escritura en BD) ───────────────────

function enemyStatsFromHero(s) {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.max(1, Math.round(v))]))
}

function grindDropDifficulty(level) {
  if (level <= 5)  return 2
  if (level <= 12) return 4
  if (level <= 20) return 6
  if (level <= 30) return 7
  return 8
}

// Pesos de rareza según dificultad (misma fórmula que getDropConfig)
function rarityWeights(dif) {
  return [
    Math.max(0,  70 - dif * 6),
    Math.max(0,  25 - dif * 0.5),
    Math.min(40, dif * 4),
    Math.min(25, Math.max(0, (dif - 4) * 4)),
    Math.min(15, Math.max(0, (dif - 7) * 5)),
  ]
}

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

function rollRarity(dif) {
  const w = rarityWeights(dif)
  const total = w.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < w.length; i++) { roll -= w[i]; if (roll <= 0) return RARITIES[i] }
  return 'common'
}

function rollTier(dif) {
  if (dif <= 3) return 1
  if (dif <= 6) return Math.random() < 0.5 ? 1 : 2
  return Math.random() < 0.5 ? 2 : 3
}

function rollCombat(won, heroLevel) {
  const gold = won ? 20 + Math.floor(Math.random() * 21) : 5  + Math.floor(Math.random() * 8)
  const xp   = won ? 30 + Math.floor(Math.random() * 21) : 10 + Math.floor(Math.random() * 11)

  let fragments = 0, item = null, tactic = false
  if (won) {
    if (Math.random() < 0.15) fragments = 1 + Math.floor(Math.random() * 3)
    if (Math.random() < 0.15) {
      const dif = grindDropDifficulty(heroLevel)
      item = { rarity: rollRarity(dif), tier: rollTier(dif) }
    }
    if (Math.random() < 0.08) tactic = true
  }
  return { gold, xp, fragments, item, tactic }
}

// ── Simulación por héroe ──────────────────────────────────────────────────────

async function simulateHero(hero) {
  const heroStats = await getEffectiveStats(supabase, hero.id, hero.player_id)
  if (!heroStats) return null

  const { data: tacticRows } = await supabase
    .from('hero_tactics').select('level, tactic_catalog(name, icon, combat_effect)')
    .eq('hero_id', hero.id).not('slot_index', 'is', null)
  const heroTactics = (tacticRows ?? []).filter(r => r.tactic_catalog).map(r => ({
    name: r.tactic_catalog.name, icon: r.tactic_catalog.icon,
    level: r.level, combat_effect: r.tactic_catalog.combat_effect,
  }))

  const vTactics   = Math.min(21, hero.level * 3)
  const enemyStats = enemyStatsFromHero(heroStats)

  // Contadores
  let wins = 0
  let totalGold = 0, totalXp = 0, totalFrags = 0, totalTactics = 0
  let totalHpSpent = 0, roundsTotal = 0
  const itemsByRarity = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
  const itemsByTier   = { 1: 0, 2: 0, 3: 0 }

  for (let i = 0; i < COMBATS; i++) {
    const result = simulateCombat(heroStats, enemyStats, {
      classA: hero.class, classB: hero.class,
      tacticsA: heroTactics,
      tacticsB: generateEnemyTactics(vTactics, hero.class),
    })
    const won = result.winner === 'a'
    if (won) wins++
    roundsTotal += result.rounds ?? 0
    totalHpSpent += Math.round(heroStats.max_hp * (won ? COMBAT_HP_COST.grind.win : COMBAT_HP_COST.grind.loss))

    const r = rollCombat(won, hero.level)
    totalGold  += r.gold
    totalXp    += r.xp
    totalFrags += r.fragments
    if (r.tactic) totalTactics++
    if (r.item) {
      itemsByRarity[r.item.rarity]++
      itemsByTier[r.item.tier]++
    }
  }

  const totalItems = Object.values(itemsByRarity).reduce((a, b) => a + b, 0)
  const winRate    = wins / COMBATS

  return {
    hero, heroStats, heroTactics: heroTactics.length,
    wins, winRate,
    avgRounds:  (roundsTotal / COMBATS).toFixed(1),
    totalGold, totalXp, totalFrags, totalItems, totalTactics,
    itemsByRarity, itemsByTier,
    totalHpSpent,
    potionsFor1000: Math.ceil((heroStats.max_hp * winRate * COMBAT_HP_COST.grind.win * 1000 +
                               heroStats.max_hp * (1-winRate) * COMBAT_HP_COST.grind.loss * 1000) /
                              (heroStats.max_hp * 0.40)),
  }
}

// ── Formato ───────────────────────────────────────────────────────────────────

function bar(pct, width = 20) {
  const f = Math.round((pct / 100) * width)
  return '█'.repeat(f) + '░'.repeat(width - f)
}

function pct(n, total) { return total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%' }

function rarityLabel(r) {
  return { common: 'Común', uncommon: 'Poco común', rare: 'Rara', epic: 'Épica', legendary: 'Legendaria' }[r] ?? r
}

async function main() {
  console.log(`\n🎲  Simulación Grindeo — ${COMBATS} combates por héroe\n`)

  const { data: heroes, error } = await supabase
    .from('heroes').select('id, name, class, level, max_hp, current_hp, player_id, status')
    .order('level', { ascending: false })
  if (error) { console.error(error.message); process.exit(1) }
  if (!heroes?.length) { console.log('Sin héroes.'); process.exit(0) }

  const results = []
  for (const hero of heroes) {
    process.stdout.write(`  ${hero.name} (${hero.class} Nv.${hero.level})... `)
    const res = await simulateHero(hero)
    if (!res) { console.log('⚠ sin stats'); continue }
    results.push(res)
    console.log(`winrate ${(res.winRate * 100).toFixed(1)}%`)
  }

  for (const r of results) {
    const dif    = grindDropDifficulty(r.hero.level)
    const wrPct  = r.winRate * 100
    const alert  = wrPct > 75 ? '  ⚠ MUY FÁCIL' : wrPct < 35 ? '  ⚠ MUY DIFÍCIL' : ''

    console.log(`\n${'═'.repeat(72)}`)
    console.log(`  ${r.hero.name}  [${r.hero.class} · Nv.${r.hero.level}]  drop dificultad: ${dif}${alert}`)
    console.log(`  HP: ${r.heroStats.max_hp}  ATQ: ${r.heroStats.attack}  DEF: ${r.heroStats.defense}  Tácticas: ${r.heroTactics}`)
    console.log()

    // Winrate
    console.log(`  COMBATE`)
    console.log(`  Victorias  ${r.wins}/${COMBATS}  ${bar(wrPct)}  ${wrPct.toFixed(1)}%`)
    console.log(`  Rondas/combate: ${r.avgRounds}  |  HP gastado total: ${r.totalHpSpent}`)
    console.log(`  Pociones para 1000 combates: ~${r.potionsFor1000}  (cada poción = ${Math.floor(r.heroStats.max_hp * 0.40 / (r.heroStats.max_hp * (r.winRate * COMBAT_HP_COST.grind.win + (1-r.winRate) * COMBAT_HP_COST.grind.loss))).toFixed(0)} combates)`)
    console.log()

    // Drops por combate
    const itemRate   = r.totalItems   / COMBATS
    const fragRate   = r.totalFrags   / COMBATS
    const tacticRate = r.totalTactics / COMBATS

    console.log(`  DROPS (por combate, victorias y derrotas)`)
    console.log(`  Frags:    ${fragRate.toFixed(3)}/combate  |  total ${r.totalFrags}  (esperado ~${(0.15 * 2 * r.winRate).toFixed(3)})`)
    console.log(`  Ítems:    ${itemRate.toFixed(3)}/combate  |  total ${r.totalItems}  (esperado ~${(0.15 * r.winRate).toFixed(3)})`)
    console.log(`  Tácticas: ${tacticRate.toFixed(3)}/combate  |  total ${r.totalTactics}  (esperado ~${(0.08 * r.winRate).toFixed(3)})`)
    console.log()

    // Distribución de rareza de ítems
    if (r.totalItems > 0) {
      console.log(`  CALIDAD DE ÍTEMS (${r.totalItems} total)`)
      const w = rarityWeights(dif)
      const wTotal = w.reduce((a, b) => a + b, 0)
      for (let i = 0; i < RARITIES.length; i++) {
        const actual   = r.itemsByRarity[RARITIES[i]] ?? 0
        const expected = ((w[i] / wTotal) * 100).toFixed(1)
        if (actual === 0 && w[i] === 0) continue
        console.log(`  ${rarityLabel(RARITIES[i]).padEnd(12)} ${String(actual).padStart(4)} items  ${pct(actual, r.totalItems).padStart(6)}  (esperado ${expected}%)  ${bar(parseFloat(pct(actual, r.totalItems)), 16)}`)
      }
      console.log()
      console.log(`  Tier 1: ${r.itemsByTier[1]}  Tier 2: ${r.itemsByTier[2] ?? 0}  Tier 3: ${r.itemsByTier[3] ?? 0}`)
    }
  }

  // Resumen por clase
  console.log(`\n${'═'.repeat(72)}`)
  console.log('  WINRATE POR CLASE')
  const byClass = {}
  for (const r of results) {
    const c = r.hero.class
    if (!byClass[c]) byClass[c] = { wins: 0, total: 0 }
    byClass[c].wins += r.wins; byClass[c].total += COMBATS
  }
  for (const [cls, d] of Object.entries(byClass)) {
    const p = (d.wins / d.total * 100).toFixed(1)
    console.log(`  ${cls.padEnd(12)} ${bar(parseFloat(p), 24)}  ${p}%`)
  }
  console.log(`${'═'.repeat(72)}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
