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
 * @param {number} vl - Virtual Level / dificultad del enemigo (1-21+)
 * @param {string} [archetypeKey] - Clave del arquetipo ('berserker','tank','assassin','mage')
 * @param {Function} [rng] - Función random (para tests)
 * @returns {Array<{name, icon, level, combat_effect}>}
 */
export function generateEnemyTactics(vl, archetypeKey, rng = Math.random) {
  let count, minLevel, maxLevel

  if (vl <= 5) {
    count = rng() < 0.5 ? 1 : 2
    minLevel = 1; maxLevel = 1
  } else if (vl <= 12) {
    count = rng() < 0.4 ? 2 : 3
    minLevel = 1; maxLevel = 2
  } else if (vl <= 18) {
    count = rng() < 0.4 ? 3 : 4
    minLevel = 2; maxLevel = 3
  } else {
    count = rng() < 0.3 ? 4 : 5
    minLevel = 3; maxLevel = 4
  }

  const pool = ARCHETYPE_POOLS[archetypeKey] ?? MIXED_POOL
  const shuffled = [...pool].sort(() => rng() - 0.5)
  const picked = shuffled.slice(0, Math.min(count, shuffled.length))

  return picked.map(t => ({
    name: t.name,
    icon: t.icon,
    level: minLevel + Math.floor(rng() * (maxLevel - minLevel + 1)),
    combat_effect: t.combat_effect,
  }))
}
