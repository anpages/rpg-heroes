/**
 * Genera tácticas para enemigos IA basándose en su nivel virtual (VL) y arquetipo.
 *
 * El sistema escala la cantidad y nivel de tácticas con la dificultad:
 *   VL  1-5:  1-2 tácticas nv.1
 *   VL  6-12: 2-3 tácticas nv.1-2
 *   VL 13-18: 3-4 tácticas nv.2-3
 *   VL 19-21: 4-5 tácticas nv.3-4
 *
 * Cada arquetipo tiene un pool temático de tácticas y combos sinérgicos
 * que el sistema prioriza para que el enemigo parezca coherente, no aleatorio.
 */

const ARCHETYPE_POOLS = {
  berserker: [
    { name: 'Emboscada',         icon: '🗡', combat_effect: { trigger: 'start_of_combat', effect: 'guaranteed_crit', duration: 1 } },
    { name: 'Furia Interior',    icon: '🔥', combat_effect: { trigger: 'hp_below_pct', threshold: 0.30, effect: 'damage_mult', value: 1.40, duration: 2 } },
    { name: 'Sed de Sangre',     icon: '🩸', combat_effect: { trigger: 'on_crit', effect: 'heal_pct', value: 0.08 } },
    { name: 'Impacto Demoledor', icon: '💥', combat_effect: { trigger: 'round_n', n: 4, effect: 'armor_pen_boost', value: 0.20, duration: 2 } },
    { name: 'Tormenta de Acero', icon: '⚡', combat_effect: { trigger: 'round_n', n: 5, effect: 'double_attack', duration: 1 } },
  ],
  tank: [
    { name: 'Muro de Hierro',            icon: '🛡', combat_effect: { trigger: 'round_n', n: 3, effect: 'absorb_shield', value: 0.20 } },
    { name: 'Instinto de Supervivencia', icon: '💚', combat_effect: { trigger: 'hp_below_pct', threshold: 0.25, effect: 'heal_pct', value: 0.15, once: true } },
    { name: 'Postura Férrea',            icon: '🏔', combat_effect: { trigger: 'passive', effect: 'reduce_crit_damage', value: 0.30 } },
    { name: 'Voluntad Inquebrantable',   icon: '🔱', combat_effect: { trigger: 'hp_below_pct', threshold: 0.50, effect: 'damage_reduction', value: 0.15, duration: 3 } },
    { name: 'Coraza Vital',             icon: '🫀', combat_effect: { trigger: 'round_n', n: 2, effect: 'absorb_shield', value: 0.25 } },
  ],
  assassin: [
    { name: 'Paso Veloz',         icon: '💨', combat_effect: { trigger: 'round_n', n: 4, effect: 'guaranteed_dodge', duration: 1 } },
    { name: 'Concentración',      icon: '🎯', combat_effect: { trigger: 'on_dodge', effect: 'damage_mult_next', value: 1.50 } },
    { name: 'Golpe Brutal',       icon: '↩', combat_effect: { trigger: 'hp_below_pct', threshold: 0.50, effect: 'damage_mult', value: 1.30, duration: 2, once: true } },
    { name: 'Lectura de Combate', icon: '👁', combat_effect: { trigger: 'round_n', n: 2, effect: 'dodge_boost', value: 0.25, duration: 2 } },
    { name: 'Emboscada',          icon: '🗡', combat_effect: { trigger: 'start_of_combat', effect: 'guaranteed_crit', duration: 1 } },
  ],
  mage: [
    { name: 'Golpe Arcano',    icon: '✨', combat_effect: { trigger: 'round_n', n: 3, effect: 'bonus_magic_damage', value: 0.50 } },
    { name: 'Trampa Táctica',  icon: '🪤', combat_effect: { trigger: 'round_n', n: 1, effect: 'enemy_debuff', stat: 'attack', value: 0.15, duration: 3 } },
    { name: 'Velo Arcano',     icon: '📋', combat_effect: { trigger: 'start_of_combat', effect: 'dodge_boost', value: 0.15, duration: 3 } },
    { name: 'Escudo Místico',  icon: '👑', combat_effect: { trigger: 'hp_below_pct', threshold: 0.50, effect: 'damage_reduction', value: 0.20, duration: 2, once: true } },
    { name: 'Segundo Aliento', icon: '🌬', combat_effect: { trigger: 'round_n', n: 6, effect: 'heal_pct', value: 0.12 } },
  ],
}

// Fallback para arquetipos desconocidos: pool mixto
const MIXED_POOL = [
  ...ARCHETYPE_POOLS.berserker.slice(0, 2),
  ...ARCHETYPE_POOLS.tank.slice(0, 2),
  ...ARCHETYPE_POOLS.assassin.slice(0, 1),
]

/**
 * Combos sinérgicos por arquetipo.
 * Cuando el enemigo tiene suficientes slots, el sistema garantiza al menos
 * un combo completo para que las tácticas se potencien entre sí.
 *
 * berserker: Emboscada → Sed de Sangre  (crit del inicio cura al atacar)
 *            Tormenta de Acero → Furia Interior  (doble ataque cuando va ganando, burst cuando va perdiendo)
 * tank:      Coraza Vital → Muro de Hierro  (escudos alternos: ronda 2 y ronda 3)
 *            Voluntad Inquebrantable → Instinto de Supervivencia  (dos salvavidas al bajar HP)
 * assassin:  Lectura de Combate → Concentración  (dodge_boost activa on_dodge damage_mult)
 *            Paso Veloz → Concentración  (dodge garantizado activa on_dodge damage_mult)
 * mage:      Trampa Táctica → Golpe Arcano  (debuffa ataque y golpea con magia ignorando defensa)
 *            Velo Arcano → Escudo Místico  (esquiva al inicio, se protege cuando baja HP)
 */
const ARCHETYPE_SYNERGIES = {
  berserker: [
    ['Emboscada', 'Sed de Sangre'],
    ['Tormenta de Acero', 'Furia Interior'],
  ],
  tank: [
    ['Coraza Vital', 'Muro de Hierro'],
    ['Voluntad Inquebrantable', 'Instinto de Supervivencia'],
  ],
  assassin: [
    ['Lectura de Combate', 'Concentración'],
    ['Paso Veloz', 'Concentración'],
  ],
  mage: [
    ['Trampa Táctica', 'Golpe Arcano'],
    ['Velo Arcano', 'Escudo Místico'],
  ],
}

/**
 * Devuelve { count, minLevel, maxLevel } según VL.
 */
function tacticScaling(vl, rng) {
  if (vl <= 5)  return { count: rng() < 0.5 ? 1 : 2, minLevel: 1, maxLevel: 1 }
  if (vl <= 12) return { count: rng() < 0.4 ? 2 : 3, minLevel: 1, maxLevel: 2 }
  if (vl <= 18) return { count: rng() < 0.4 ? 3 : 4, minLevel: 1, maxLevel: 3 }
  return        { count: rng() < 0.3 ? 4 : 5,        minLevel: 2, maxLevel: 4 }
}

/**
 * Construye el array final de tácticas priorizando combos sinérgicos.
 * Si count >= 2 y hay sinergias para el arquetipo, garantiza que al menos
 * un combo completo aparezca; los slots restantes se rellenan al azar.
 */
function buildTactics(pool, count, minLevel, maxLevel, rng, archetypeKey) {
  const selected = []
  const usedNames = new Set()

  // Intentar incluir un combo sinérgico completo
  const synergies = ARCHETYPE_SYNERGIES[archetypeKey] ?? []
  if (count >= 2 && synergies.length > 0) {
    const shuffledSynergies = [...synergies].sort(() => rng() - 0.5)
    for (const group of shuffledSynergies) {
      const groupTactics = group.map(name => pool.find(t => t.name === name)).filter(Boolean)
      if (groupTactics.length >= 2) {
        for (const t of groupTactics) {
          if (selected.length < count) {
            selected.push(t)
            usedNames.add(t.name)
          }
        }
        break
      }
    }
  }

  // Rellenar slots restantes con el resto del pool en orden aleatorio
  const remaining = [...pool].filter(t => !usedNames.has(t.name)).sort(() => rng() - 0.5)
  for (const t of remaining) {
    if (selected.length >= count) break
    selected.push(t)
  }

  return selected.map(t => ({
    name: t.name,
    icon: t.icon,
    level: minLevel + Math.floor(rng() * (maxLevel - minLevel + 1)),
    combat_effect: t.combat_effect,
  }))
}

/**
 * @param {number} vl
 * @param {string} [archetypeKey]
 * @param {Function} [rng]
 */
export function generateEnemyTactics(vl, archetypeKey, rng = Math.random) {
  const { count, minLevel, maxLevel } = tacticScaling(vl, rng)
  const pool = ARCHETYPE_POOLS[archetypeKey] ?? MIXED_POOL
  return buildTactics(pool, count, minLevel, maxLevel, rng, archetypeKey)
}

/**
 * Genera tácticas que contrarrestan las stats reales del héroe.
 * Combina el pool temático del arquetipo con tácticas counter basadas
 * en los puntos fuertes del héroe, y prioriza combos sinérgicos.
 *
 *  - Alta defensa  → penetración de armadura
 *  - Alto ataque   → escudos y reducción de daño
 *  - HP bajo       → burst (crit garantizado, damage_mult)
 *  - HP alto       → debuffs y veneno que alargan el combate
 *
 * @param {number} vl
 * @param {string} archetypeKey
 * @param {{ attack, defense, agility, max_hp }} heroStats
 * @param {Function} [rng]
 */
export function generateCounterTactics(vl, archetypeKey, heroStats = {}, rng = Math.random) {
  const { count, minLevel, maxLevel } = tacticScaling(vl, rng)
  const basePool = ARCHETYPE_POOLS[archetypeKey] ?? MIXED_POOL

  const { attack = 50, defense = 50, max_hp = 300 } = heroStats

  // Tácticas de counter por categoría (todas son efectos que funcionan)
  const armorPen  = [ARCHETYPE_POOLS.berserker[3]]                                          // Impacto Demoledor
  const burst     = [ARCHETYPE_POOLS.berserker[0], ARCHETYPE_POOLS.berserker[1], ARCHETYPE_POOLS.berserker[4]] // Emboscada, Furia, Tormenta
  const mitigation = [ARCHETYPE_POOLS.tank[0], ARCHETYPE_POOLS.tank[3], ARCHETYPE_POOLS.tank[4]]              // escudos, reducción
  const debuff    = [ARCHETYPE_POOLS.mage[1]]                                               // Trampa Táctica (enemy_debuff attack)

  const counterCandidates = []
  if (defense >= 60)                              counterCandidates.push(...armorPen, ...armorPen) // doble peso
  if (attack >= 65)                               counterCandidates.push(...mitigation)
  if (max_hp < 250)                               counterCandidates.push(...burst)
  if (max_hp >= 350 || (defense >= 50 && attack >= 50)) counterCandidates.push(...debuff)

  let finalPool
  if (counterCandidates.length > 0) {
    const dedupedCounters = counterCandidates.filter(
      (t, i, arr) => arr.findIndex(x => x.name === t.name) === i
    )
    const remainingBase = basePool.filter(t => !dedupedCounters.some(c => c.name === t.name))
    // Counters al inicio → prioridad en el slice; base rellena el resto
    finalPool = [...dedupedCounters, ...remainingBase]
  } else {
    finalPool = basePool
  }

  return buildTactics(finalPool, count, minLevel, maxLevel, rng, archetypeKey)
}
