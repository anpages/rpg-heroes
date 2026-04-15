/**
 * Genera tácticas para enemigos IA basándose en su nivel virtual (VL) y arquetipo.
 *
 * El sistema escala la cantidad y nivel de tácticas con la dificultad:
 *   VL  1-5:  1-2 tácticas nv.1
 *   VL  6-12: 2-3 tácticas nv.1-2
 *   VL 13-18: 3-4 tácticas nv.2-3
 *   VL 19-21: 4-5 tácticas nv.3-4
 *
 * Cada arquetipo tiene un pool temático de tácticas.
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
    { name: 'Muro de Hierro',             icon: '🛡', combat_effect: { trigger: 'round_n', n: 3, effect: 'absorb_shield', value: 0.20 } },
    { name: 'Instinto de Supervivencia',   icon: '💚', combat_effect: { trigger: 'hp_below_pct', threshold: 0.25, effect: 'heal_pct', value: 0.15, once: true } },
    { name: 'Postura Férrea',              icon: '🏔', combat_effect: { trigger: 'passive', effect: 'reduce_crit_damage', value: 0.30 } },
    { name: 'Voluntad Inquebrantable',     icon: '🔱', combat_effect: { trigger: 'hp_below_pct', threshold: 0.50, effect: 'damage_reduction', value: 0.15, duration: 3 } },
    { name: 'Coraza Vital',               icon: '🫀', combat_effect: { trigger: 'round_n', n: 2, effect: 'absorb_shield', value: 0.25 } },
  ],
  assassin: [
    { name: 'Paso Veloz',          icon: '💨', combat_effect: { trigger: 'round_n', n: 4, effect: 'guaranteed_dodge', duration: 1 } },
    { name: 'Concentración',       icon: '🎯', combat_effect: { trigger: 'on_dodge', effect: 'damage_mult_next', value: 1.50 } },
    { name: 'Contraataque',        icon: '↩', combat_effect: { trigger: 'hp_below_pct', threshold: 0.50, effect: 'counter_attack', chance: 0.40 } },
    { name: 'Lectura de Combate',  icon: '👁', combat_effect: { trigger: 'round_n', n: 2, effect: 'dodge_boost', value: 0.25, duration: 2 } },
    { name: 'Emboscada',           icon: '🗡', combat_effect: { trigger: 'start_of_combat', effect: 'guaranteed_crit', duration: 1 } },
  ],
  mage: [
    { name: 'Golpe Arcano',          icon: '✨', combat_effect: { trigger: 'round_n', n: 3, effect: 'bonus_magic_damage', value: 0.50 } },
    { name: 'Trampa Táctica',        icon: '🪤', combat_effect: { trigger: 'round_n', n: 1, effect: 'enemy_debuff', stat: 'attack', value: 0.15, duration: 3 } },
    { name: 'Preparación Táctica',   icon: '📋', combat_effect: { trigger: 'start_of_combat', effect: 'stat_buff', stat: 'agility', value: 0.20, duration: 3 } },
    { name: 'Aura de Liderazgo',     icon: '👑', combat_effect: { trigger: 'passive', effect: 'all_stats_pct', value: 0.03 } },
    { name: 'Segundo Aliento',       icon: '🌬', combat_effect: { trigger: 'round_n', n: 6, effect: 'heal_pct', value: 0.12 } },
  ],
}

// Fallback para arquetipos desconocidos: pool mixto
const MIXED_POOL = [
  ...ARCHETYPE_POOLS.berserker.slice(0, 2),
  ...ARCHETYPE_POOLS.tank.slice(0, 2),
  ...ARCHETYPE_POOLS.assassin.slice(0, 1),
]

/**
 * Devuelve { count, minLevel, maxLevel } según VL.
 * @param {number} vl
 * @param {Function} rng
 */
function tacticScaling(vl, rng) {
  if (vl <= 5)  return { count: rng() < 0.5 ? 1 : 2, minLevel: 1, maxLevel: 1 }
  if (vl <= 12) return { count: rng() < 0.4 ? 2 : 3, minLevel: 1, maxLevel: 2 }
  if (vl <= 18) return { count: rng() < 0.4 ? 3 : 4, minLevel: 2, maxLevel: 3 }
  return        { count: rng() < 0.3 ? 4 : 5,        minLevel: 3, maxLevel: 4 }
}

function buildTactics(pool, count, minLevel, maxLevel, rng) {
  const shuffled = [...pool].sort(() => rng() - 0.5)
  const picked = shuffled.slice(0, Math.min(count, shuffled.length))
  return picked.map(t => ({
    name: t.name,
    icon: t.icon,
    level: minLevel + Math.floor(rng() * (maxLevel - minLevel + 1)),
    combat_effect: t.combat_effect,
  }))
}

/**
 * @param {number} vl - Virtual Level / dificultad del enemigo (1-21+)
 * @param {string} [archetypeKey] - Clave del arquetipo ('berserker','tank','assassin','mage')
 * @param {Function} [rng] - Función random (para tests)
 * @returns {Array<{name, icon, level, combat_effect}>}
 */
export function generateEnemyTactics(vl, archetypeKey, rng = Math.random) {
  const { count, minLevel, maxLevel } = tacticScaling(vl, rng)
  const pool = ARCHETYPE_POOLS[archetypeKey] ?? MIXED_POOL
  return buildTactics(pool, count, minLevel, maxLevel, rng)
}

/**
 * Genera tácticas que contrarrestan las stats reales del héroe.
 * La IA examina los puntos fuertes del héroe y selecciona tácticas
 * que los anulan directamente.
 *
 * Lógica de contramedidas:
 *  - Alta defensa  → preferir armor_pen (penetración de armadura)
 *  - Alta agilidad → preferir accuracy/dodge_boost enemigo (dificultar esquiva)
 *  - Alto ataque   → preferir damage_reduction / absorb_shield
 *  - Poco HP       → preferir burst/execute (guaranteed_crit, damage_mult)
 *  - Alto HP       → preferir debuffs que alargan el combate (enemy_debuff, armor_pen)
 *
 * @param {number} vl
 * @param {string} archetypeKey
 * @param {{ attack, defense, agility, max_hp }} heroStats
 * @param {Function} [rng]
 */
export function generateCounterTactics(vl, archetypeKey, heroStats = {}, rng = Math.random) {
  const { count, minLevel, maxLevel } = tacticScaling(vl, rng)
  const basePool = ARCHETYPE_POOLS[archetypeKey] ?? MIXED_POOL

  // Pesos de contramedida basados en las stats del héroe
  const { attack = 50, defense = 50, agility = 50, max_hp = 300 } = heroStats

  // Tácticas de penetración (counters defensa alta)
  const armorPen = [ARCHETYPE_POOLS.berserker[3]] // Impacto Demoledor — armor_pen_boost

  // Tácticas de burst/execute (counters HP bajo o para cerrar combates)
  const burst = [
    ARCHETYPE_POOLS.berserker[0], // Emboscada — guaranteed_crit
    ARCHETYPE_POOLS.berserker[1], // Furia Interior — damage_mult
    ARCHETYPE_POOLS.berserker[4], // Tormenta de Acero — double_attack
  ]

  // Tácticas de reducción de daño (counters ataque alto)
  const mitigation = [
    ARCHETYPE_POOLS.tank[0], // Muro de Hierro — absorb_shield
    ARCHETYPE_POOLS.tank[3], // Voluntad Inquebrantable — damage_reduction
    ARCHETYPE_POOLS.tank[4], // Coraza Vital — absorb_shield
  ]

  // Tácticas de debuff (counters stats equilibradas / HP alto)
  const debuff = [
    ARCHETYPE_POOLS.mage[1], // Trampa Táctica — enemy_debuff attack
    ARCHETYPE_POOLS.mage[2], // Preparación Táctica — stat_buff agility
  ]

  // Construir pool ponderado: mezcla pool base del arquetipo con tácticas counter
  // Las counter tienen peso ~40%; el resto viene del pool normal del arquetipo
  const counterCandidates = []

  // Defensa alta → penetración
  if (defense >= 60) counterCandidates.push(...armorPen, ...armorPen) // peso ×2

  // Ataque alto → mitigación
  if (attack >= 65) counterCandidates.push(...mitigation)

  // HP bajo → burst
  if (max_hp < 250) counterCandidates.push(...burst)

  // HP alto / stats equilibradas → debuffs
  if (max_hp >= 350 || (defense >= 50 && attack >= 50)) counterCandidates.push(...debuff)

  // Pool final: 60% arquetipo base, 40% counter (si hay candidatos)
  let finalPool
  if (counterCandidates.length > 0) {
    // Deduplicar por nombre
    const allById = new Map()
    for (const t of basePool) allById.set(t.name, t)
    for (const t of counterCandidates) allById.set(t.name, t)
    // Mantener counter al inicio del array para que el slice las priorice
    const dedupedCounters = counterCandidates.filter(
      (t, i, arr) => arr.findIndex(x => x.name === t.name) === i
    )
    const remainingBase = basePool.filter(t => !dedupedCounters.some(c => c.name === t.name))
    finalPool = [...dedupedCounters, ...remainingBase]
  } else {
    finalPool = basePool
  }

  return buildTactics(finalPool, count, minLevel, maxLevel, rng)
}
