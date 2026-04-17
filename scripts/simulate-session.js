/**
 * Simulación de sesión realista de grindeo.
 * Calcula cuántos combates puede hacer cada héroe con su HP actual,
 * cuántos con pociones, y cuántas sesiones/pociones se necesitan para cada drop.
 *
 * Uso: node scripts/simulate-session.js
 */

import { createClient } from '@supabase/supabase-js'
import { simulateCombat } from '../api/_combat.js'
import { getEffectiveStats } from '../api/_stats.js'
import { generateEnemyTactics } from '../api/_enemyTactics.js'
import { COMBAT_HP_COST } from '../src/lib/gameConstants.js'

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL     ?? process.env.SUPABASE_URL
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE) { console.error('Faltan variables de entorno'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

// ── Parámetros del sistema ────────────────────────────────────────────────────
const MIN_HP_PCT    = 0.20   // no puede combatir por debajo del 20%
const POTION_RESTORE = 0.40  // restaura 40% max_hp

// Drop rates actuales (solo victoria)
const DROP_FRAG_RATE  = 0.15
const DROP_FRAG_AVG   = 2.0  // avg de 1-3
const DROP_ITEM_RATE   = 0.15
const DROP_TACTIC_RATE = 0.08

// ── Simulación de winrate real (N combates) ────────────────────────────────────
function enemyStatsFromHero(heroStats) {
  return Object.fromEntries(
    Object.entries(heroStats).map(([k, v]) => [k, Math.max(1, Math.round(v * 1.0))])
  )
}

async function measureWinrate(hero, heroStats, n = 500) {
  const vTactics = Math.min(21, hero.level * 3)
  const enemyStats = enemyStatsFromHero(heroStats)
  let wins = 0
  for (let i = 0; i < n; i++) {
    const result = simulateCombat(heroStats, enemyStats, {
      classA: hero.class, classB: hero.class,
      tacticsA: [], // sin tácticas del héroe para medir base
      tacticsB: generateEnemyTactics(vTactics, hero.class),
    })
    // Con tácticas reales
    if (result.winner === 'a') wins++
  }
  return wins / n
}

async function measureWinrateWithTactics(hero, heroStats, heroTactics, n = 500) {
  const vTactics   = Math.min(21, hero.level * 3)
  const enemyStats = enemyStatsFromHero(heroStats)
  let wins = 0
  for (let i = 0; i < n; i++) {
    const result = simulateCombat(heroStats, enemyStats, {
      classA: hero.class, classB: hero.class,
      tacticsA: heroTactics,
      tacticsB: generateEnemyTactics(vTactics, hero.class),
    })
    if (result.winner === 'a') wins++
  }
  return wins / n
}

// ── Cálculo de sesión ─────────────────────────────────────────────────────────
function calcSession(currentHp, maxHp, winrate) {
  const minHp    = Math.ceil(maxHp * MIN_HP_PCT)
  const available = Math.max(0, currentHp - minHp)
  const costWin  = Math.round(maxHp * COMBAT_HP_COST.grind.win)
  const costLoss = Math.round(maxHp * COMBAT_HP_COST.grind.loss)
  const avgCost  = winrate * costWin + (1 - winrate) * costLoss

  const combatsNoPotion = Math.floor(available / avgCost)
  const combatsPerPotion = Math.floor(maxHp * POTION_RESTORE / avgCost)

  return { minHp, available, avgCost: avgCost.toFixed(1), combatsNoPotion, combatsPerPotion, costWin, costLoss }
}

// ── Probabilidad de obtener al menos 1 drop en N combates ─────────────────────
function dropProbInN(ratePerCombat, n) {
  return (1 - Math.pow(1 - ratePerCombat, n)) * 100
}

// ── Combates esperados para primer drop ──────────────────────────────────────
function combatsForDrop(ratePerCombat) {
  return ratePerCombat > 0 ? Math.round(1 / ratePerCombat) : Infinity
}

function fmt(n) { return n === Infinity ? '∞' : n.toString() }

async function main() {
  console.log('\n🔬  Simulación de sesión realista de grindeo\n')

  // Potiones disponibles por jugador
  const { data: potionRows } = await supabase
    .from('player_crafted_items')
    .select('recipe_id, quantity, player_id')
    .eq('recipe_id', 'potion_vida')
    .gt('quantity', 0)

  const potionsByPlayer = {}
  for (const row of potionRows ?? []) potionsByPlayer[row.player_id] = row.quantity

  const { data: heroes } = await supabase
    .from('heroes')
    .select('id, name, class, level, max_hp, current_hp, hp_last_updated_at, player_id, status')
    .order('level', { ascending: false })

  if (!heroes?.length) { console.log('No hay héroes'); return }

  for (const hero of heroes) {
    console.log(`${'─'.repeat(68)}`)
    const potions = potionsByPlayer[hero.player_id] ?? 0
    console.log(`  ${hero.name}  [${hero.class} · Nv.${hero.level}]  —  estado: ${hero.status}  |  pociones disponibles: ${potions}`)

    const heroStats = await getEffectiveStats(supabase, hero.id, hero.player_id)
    if (!heroStats) { console.log('  ⚠ sin stats\n'); continue }

    // Tácticas equipadas
    const { data: tacticRows } = await supabase
      .from('hero_tactics').select('level, tactic_catalog(name, icon, combat_effect)')
      .eq('hero_id', hero.id).not('slot_index', 'is', null)
    const heroTactics = (tacticRows ?? []).filter(r => r.tactic_catalog).map(r => ({
      name: r.tactic_catalog.name, icon: r.tactic_catalog.icon,
      level: r.level, combat_effect: r.tactic_catalog.combat_effect,
    }))

    process.stdout.write(`  Midiendo winrate (500 combates)... `)
    const winrate = await measureWinrateWithTactics(hero, heroStats, heroTactics)
    console.log(`${(winrate * 100).toFixed(1)}%  |  tácticas equipadas: ${heroTactics.length}`)

    const s = calcSession(hero.current_hp, heroStats.max_hp, winrate)
    console.log(`\n  HP actual: ${hero.current_hp}/${heroStats.max_hp}  |  mínimo para combatir: ${s.minHp}  |  HP usable: ${s.available}`)
    console.log(`  Coste medio por combate: ${s.avgCost} HP  (${s.costWin} victoria / ${s.costLoss} derrota)`)

    // Sesión sin pociones
    console.log(`\n  ┌─ SIN POCIONES`)
    console.log(`  │  Combates posibles esta sesión: ${s.combatsNoPotion}`)

    // Drops en esa sesión
    const fragRatePerCombat  = DROP_FRAG_RATE * DROP_FRAG_AVG * winrate
    const itemRatePerCombat  = DROP_ITEM_RATE * winrate
    const tacticRatePerCombat = DROP_TACTIC_RATE * winrate

    const fragsInSession  = (fragRatePerCombat  * s.combatsNoPotion).toFixed(2)
    const itemsInSession  = (itemRatePerCombat  * s.combatsNoPotion).toFixed(3)
    const tacticInSession = (tacticRatePerCombat * s.combatsNoPotion).toFixed(3)

    const probFrag  = dropProbInN(fragRatePerCombat,  s.combatsNoPotion).toFixed(0)
    const probItem  = dropProbInN(itemRatePerCombat,  s.combatsNoPotion).toFixed(0)
    const probTactic = dropProbInN(tacticRatePerCombat, s.combatsNoPotion).toFixed(0)

    console.log(`  │  Frags esperados:   ${fragsInSession}  |  prob de sacar ≥1 frag:    ${probFrag}%`)
    console.log(`  │  Ítems esperados:   ${itemsInSession}  |  prob de sacar ≥1 ítem:    ${probItem}%`)
    console.log(`  │  Tácticas esperadas:${tacticInSession}  |  prob de sacar ≥1 táctica: ${probTactic}%`)

    const sessionsForItem   = itemRatePerCombat  > 0 ? (1 / (itemRatePerCombat  * s.combatsNoPotion)).toFixed(1) : '∞'
    const sessionsForTactic = tacticRatePerCombat > 0 ? (1 / (tacticRatePerCombat * s.combatsNoPotion)).toFixed(1) : '∞'
    console.log(`  │  Sesiones para 1 ítem: ~${sessionsForItem}  |  Sesiones para 1 táctica: ~${sessionsForTactic}`)

    if (potions > 0) {
      const combatsWithPotions = s.combatsNoPotion + potions * s.combatsPerPotion
      const fragsW  = (fragRatePerCombat  * combatsWithPotions).toFixed(2)
      const itemsW  = (itemRatePerCombat  * combatsWithPotions).toFixed(3)
      const probFragW  = dropProbInN(fragRatePerCombat,  combatsWithPotions).toFixed(0)
      const probItemW  = dropProbInN(itemRatePerCombat,  combatsWithPotions).toFixed(0)
      const sessionsItemW = (1 / (itemRatePerCombat * combatsWithPotions)).toFixed(1)

      console.log(`  ├─ CON ${potions} POCIONES (${combatsWithPotions} combates totales)`)
      console.log(`  │  Frags esperados: ${fragsW}  |  prob ≥1 frag:  ${probFragW}%`)
      console.log(`  │  Ítems esperados: ${itemsW}  |  prob ≥1 ítem:  ${probItemW}%`)
      console.log(`  │  Sesiones para 1 ítem gastando todas las pociones: ~${sessionsItemW}`)
    }

    // Cuántos combates para cada tipo de drop con probabilidad 50% y 80%
    const c50item   = Math.ceil(Math.log(0.5) / Math.log(1 - itemRatePerCombat))
    const c80item   = Math.ceil(Math.log(0.2) / Math.log(1 - itemRatePerCombat))
    console.log(`  └─ PARA SACAR UN ÍTEM`)
    console.log(`     50% probabilidad:  ${c50item} combates  (~${Math.ceil(c50item / s.combatsNoPotion)} sesiones sin pociones)`)
    console.log(`     80% probabilidad:  ${c80item} combates  (~${Math.ceil(c80item / s.combatsNoPotion)} sesiones sin pociones)`)
    console.log()
  }

  console.log('─'.repeat(68))
  console.log('\n  VEREDICTO DE DROPS')
  console.log(`  · Item 6%:    1 cada ~${combatsForDrop(DROP_ITEM_RATE * 0.55)} combates (con ~55% winrate)`)
  console.log(`  · Si se sube a 15%: 1 cada ~${combatsForDrop(0.15 * 0.55)} combates`)
  console.log(`  · Si se sube a 20%: 1 cada ~${combatsForDrop(0.20 * 0.55)} combates`)
  console.log(`  · Frags 15%×avg2:   ${(0.15 * 2 * 0.55).toFixed(2)} frags/combate`)
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
