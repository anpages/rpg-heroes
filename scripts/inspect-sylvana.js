import { enemyStatsForLevel, applyArchetype } from '../src/lib/gameFormulas.js'
import { critPeriod, armorPen } from '../api/_combatMath.js'
import { COMBAT_STRATEGIES } from '../src/lib/gameConstants.js'

const ARCHETYPE_STRATEGY = { berserker: 'aggressive', assassin: 'aggressive', tank: 'defensive', mage: 'balanced' }

const sylvana = { attack: 13, defense: 4, strength: 12, agility: 26, intelligence: 11, max_hp: 80 }
const liora   = { attack: 17, defense: 22, strength: 19, agility: 14, intelligence: 5, max_hp: 170 }

const base_sylvana = heroAnchoredEnemyStats(sylvana)
console.log('=== SYLVANA (base anchored) ===')
console.log(base_sylvana)

console.log('\n=== SYLVANA vs cada arquetipo (con estrategia) ===')
for (const arch of ['berserker','tank','assassin','mage']) {
  const enemy = applyArchetype(heroAnchoredEnemyStats(sylvana), arch)
  const strat = COMBAT_STRATEGIES[ARCHETYPE_STRATEGY[arch] ?? 'balanced']
  enemy.attack  = Math.round(enemy.attack  * strat.atkMult)
  enemy.defense = Math.round(enemy.defense * strat.defMult)
  console.log(`  ${arch.padEnd(12)} HP:${enemy.max_hp}  ATQ:${enemy.attack}  DEF:${enemy.defense}  AGI:${enemy.agility}  INT:${enemy.intelligence}`)
}

console.log('\n=== LIORA vs cada arquetipo (con estrategia) ===')
for (const arch of ['berserker','tank','assassin','mage']) {
  const enemy = applyArchetype(heroAnchoredEnemyStats(liora), arch)
  const strat = COMBAT_STRATEGIES[ARCHETYPE_STRATEGY[arch] ?? 'balanced']
  enemy.attack  = Math.round(enemy.attack  * strat.atkMult)
  enemy.defense = Math.round(enemy.defense * strat.defMult)
  console.log(`  ${arch.padEnd(12)} HP:${enemy.max_hp}  ATQ:${enemy.attack}  DEF:${enemy.defense}  AGI:${enemy.agility}  INT:${enemy.intelligence}`)
}

console.log('\n=== PERÍODOS DE CRÍTICO ===')
console.log(`  Sylvana AGI 26 → crit cada ${critPeriod(26)} rondas`)
console.log(`  Liora   AGI 14 → crit cada ${critPeriod(14)} rondas`)
console.log(`  Enemigo AGI ${base_sylvana.agility} → crit cada ${critPeriod(base_sylvana.agility)} rondas`)

console.log('\n=== PENETRACIÓN DE ARMADURA ===')
console.log(`  Sylvana STR 12 → pen ${(armorPen(12)*100).toFixed(1)}%`)
console.log(`  Liora   STR 19 → pen ${(armorPen(19)*100).toFixed(1)}%`)
