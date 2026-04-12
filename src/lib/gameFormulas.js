/**
 * Fórmulas de juego compartidas entre frontend y backend.
 * ÚNICA fuente de verdad — importar desde aquí, nunca duplicar.
 *
 * Backend: import desde '../../src/lib/gameFormulas.js'
 * Frontend: import desde '../lib/gameFormulas.js'
 */

/**
 * Coste de HP de una expedición.
 * - Base: 20% del max_hp por hora (proporcional a la duración).
 * - Peligro escala el coste (hasta +45% en dificultad 9).
 * - Fuerza lo reduce (hasta −40% con fuerza 100).
 */
export function expeditionHpCost(maxHp, durationMinutes, difficulty = 0, strength = 0) {
  const base             = (maxHp ?? 100) * durationMinutes / 300
  const dangerMult       = 1 + (difficulty ?? 0) * 0.05
  const strengthReduct   = Math.max(0.6, 1 - (strength ?? 0) * 0.004)
  return Math.max(1, Math.floor(base * dangerMult * strengthReduct))
}

/**
 * Reducción de duración por agilidad (hasta −25%).
 */
export function agilityDurationFactor(agility) {
  return 1 - Math.min(0.25, (agility ?? 0) * 0.003)
}

/**
 * Multiplicador de oro y XP por ataque (hasta +100%).
 * Usado en expedition-collect y en el display de DungeonCard.
 */
export function attackMultiplier(attack) {
  return 1 + Math.min(1.0, (attack ?? 0) * 0.008)
}

/**
 * Stats del enemigo de un piso de la torre.
 */
export function floorEnemyStats(floor) {
  // Pisos 1-25: crecimiento lineal normal.
  // Pisos 26+: crecimiento a mitad de ritmo para que el late-game sea alcanzable.
  const cap = 25
  const slow = Math.max(0, floor - cap)
  const fast = Math.min(floor, cap)
  return {
    max_hp:      100 + fast * 22 + slow * 12,
    attack:       8  + fast * 3  + slow * 2,
    defense:      4  + fast * 2  + slow * 1,
    strength:     3  + fast * 1  + Math.floor(slow * 0.5),
    agility:      3  + Math.floor(fast * 0.6) + Math.floor(slow * 0.3),
    intelligence: 2  + Math.floor(fast * 0.5) + Math.floor(slow * 0.25),
  }
}

/**
 * XP necesaria para subir del nivel `level` al `level + 1`.
 * Fuente de verdad única — usada en frontend y en todos los endpoints de API.
 */
export function xpRequiredForLevel(level) {
  return level * 150
}

/**
 * Recompensas por superar un piso de la torre.
 * Las recompensas dejan de escalar a partir del piso 100 (soft-cap).
 */
export function floorRewards(floor) {
  const milestone = floor % 5 === 0
  const effectiveFloor = Math.min(floor, 100)
  return {
    gold:       Math.round((30 + effectiveFloor * 15) * (milestone ? 2 : 1)),
    experience: Math.round((20 + effectiveFloor * 10) * (milestone ? 2 : 1)),
    milestone,
  }
}

/**
 * Nombre del enemigo para un piso de la torre.
 * Determinista: mismo piso → mismo nombre.
 */
const ENEMY_POOLS = [
  { max:  5, names: ['Bandido Renegado', 'Saqueador Orco', 'Goblin Feroz', 'Troll Bruto', 'Merodeador Oscuro'] },
  { max: 10, names: ['Centinela de Hierro', 'Vigía Implacable', 'Patrullero Maldito', 'Mercenario Cruel', 'Guardaespaldas Corrupto'] },
  { max: 20, names: ['Campeón Maldito', 'Berserker de Sangre', 'Cazador de Élite', 'Coloso de Piedra', 'Invocador de Sombras'] },
  { max: 50, names: ['Señor de la Guerra', 'Archimago Oscuro', 'Inquisidor de Hierro', 'Ejecutor Implacable', 'Tirano Eterno', 'Forjador de Almas'] },
  { max: Infinity, names: ['Ángel Caído', 'Archidemon', 'El Eterno', 'Señor de las Sombras', 'El Destructor', 'Dios de la Ruina', 'El Sin Nombre'] },
]

export function floorEnemyName(floor) {
  const pool = ENEMY_POOLS.find(p => floor <= p.max)?.names ?? ENEMY_POOLS[ENEMY_POOLS.length - 1].names
  return pool[floor % pool.length]
}

/* ─── Arquetipos de enemigos ────────────────────────────────────────────────── */

/**
 * Arquetipos que dan personalidad a los enemigos PvE.
 * Cada arquetipo modifica las stats base manteniéndose dentro del presupuesto
 * del piso/nivel — se intercambia poder de un stat a otro.
 *
 * Berserker → glass cannon (mucho daño, frágil)
 * Tanque    → muralla (mucho HP/def, golpea poco)
 * Asesino   → veloz y crítico (muchos críticos, frágil)
 * Místico   → daño mágico que ignora defensa
 */
export const ENEMY_ARCHETYPES = {
  berserker: {
    label: 'Berserker',
    color: '#dc2626',
    description: 'Ataques brutales pero defensa frágil',
    apply: (s) => ({
      ...s,
      max_hp:   Math.max(1, Math.round(s.max_hp  * 0.95)),
      attack:   Math.max(1, Math.round(s.attack  * 1.40)),
      defense:  Math.max(1, Math.round(s.defense * 0.70)),
      strength: Math.max(1, Math.round(s.strength * 1.25)),
    }),
  },
  tank: {
    label: 'Tanque',
    color: '#0369a1',
    description: 'Muralla con mucho HP y defensa, pero lento',
    apply: (s) => ({
      ...s,
      max_hp:  Math.max(1, Math.round(s.max_hp  * 1.40)),
      defense: Math.max(1, Math.round(s.defense * 1.50)),
      attack:  Math.max(1, Math.round(s.attack  * 0.80)),
      agility: Math.max(1, Math.round(s.agility * 0.85)),
    }),
  },
  assassin: {
    label: 'Asesino',
    color: '#7c3aed',
    description: 'Veloz y letal, muchos críticos pero frágil',
    apply: (s) => ({
      ...s,
      max_hp:  Math.max(1, Math.round(s.max_hp  * 0.85)),
      attack:  Math.max(1, Math.round(s.attack  * 1.20)),
      defense: Math.max(1, Math.round(s.defense * 0.70)),
      agility: Math.max(1, Math.round(s.agility * 1.60)),
    }),
  },
  mage: {
    label: 'Místico',
    color: '#a855f7',
    description: 'Daño mágico que ignora defensa',
    apply: (s) => ({
      ...s,
      max_hp:       Math.max(1, Math.round(s.max_hp  * 0.90)),
      defense:      Math.max(1, Math.round(s.defense * 0.75)),
      attack:       Math.max(1, Math.round(s.attack  * 1.10)),
      intelligence: (s.intelligence ?? 0) + 25,
    }),
  },
}

export const ARCHETYPE_KEYS = ['berserker', 'tank', 'assassin', 'mage']

/** Aplica las modificaciones del arquetipo a unas stats base. */
export function applyArchetype(stats, archetypeKey) {
  const arch = ENEMY_ARCHETYPES[archetypeKey]
  return arch ? arch.apply(stats) : stats
}

/** Decora el nombre del enemigo con el arquetipo. */
export function decoratedEnemyName(baseName, archetypeKey) {
  const arch = ENEMY_ARCHETYPES[archetypeKey]
  return arch ? `${arch.label} · ${baseName}` : baseName
}

/**
 * Arquetipo determinista del enemigo de un piso de la torre.
 * Mismo piso → mismo arquetipo, para que el progreso sea reproducible.
 * Pisos múltiplos de 10 garantizan Tanque (mini-jefes), múltiplos de 25 son Místicos (jefes).
 */
export function floorEnemyArchetype(floor) {
  if (floor % 25 === 0) return 'mage'
  if (floor % 10 === 0) return 'tank'
  // Distribución pseudo-aleatoria pero determinista por piso
  const idx = (floor * 7 + 3) % ARCHETYPE_KEYS.length
  return ARCHETYPE_KEYS[idx]
}

/** Arquetipo aleatorio para combate rápido / práctica. */
export function randomArchetype() {
  return ARCHETYPE_KEYS[Math.floor(Math.random() * ARCHETYPE_KEYS.length)]
}

/* ─── Combate rápido / Práctica ──────────────────────────────────────────────── */

/**
 * Stats del enemigo de práctica según nivel del héroe.
 * Escalado ~70-80% de un enemigo de torre equivalente para que sea accesible.
 * Añade variación aleatoria ±15% para que cada combate se sienta distinto.
 */
export function trainingEnemyStats(heroLevel) {
  const base = Math.max(1, heroLevel * 1.2)
  const cap  = 25
  const fast = Math.min(base, cap)
  const slow = Math.max(0, base - cap)
  const scale = 0.75  // 75% de dificultad vs torre

  function vary(v) {
    const variance = 0.85 + Math.random() * 0.30  // 0.85 – 1.15
    return Math.max(1, Math.round(v * scale * variance))
  }

  return {
    max_hp:       vary(80  + fast * 15 + slow * 8),
    attack:       vary(5   + fast * 2  + slow * 1),
    defense:      vary(2   + fast * 1  + Math.floor(slow * 0.5)),
    strength:     vary(2   + Math.floor(fast * 0.5) + Math.floor(slow * 0.25)),
    agility:      vary(2   + Math.floor(fast * 0.3) + Math.floor(slow * 0.15)),
    intelligence: vary(1   + Math.floor(fast * 0.3) + Math.floor(slow * 0.15)),
  }
}

/**
 * Stats del enemigo de quick combat anclados al TIER del héroe (virtual level).
 * El enemigo representa "un héroe bien equipado de ese tramo" — independiente
 * del poder real del jugador. Consecuencia: si tu equipo es pobre para el tier
 * en el que estás, pierdes; ese es precisamente el empujón hacia expediciones,
 * expediciones y crafteo/reparar. Gear progression = tier progression.
 *
 * El caller (quick-combat.js) obtiene el virtual level vía `virtualLevelForRating`
 * en _rating.js (Hierro III=1 ... Leyenda=21) y lo pasa aquí.
 *
 * Usa `floorEnemyStats(vl)` como baseline + varianza ±15% por stat.
 */
export function tierAnchoredEnemyStats(virtualLevel) {
  const base = floorEnemyStats(Math.max(1, virtualLevel))
  function vary(v) {
    const variance = 0.85 + Math.random() * 0.30    // 0.85 – 1.15
    return Math.max(1, Math.round((v ?? 0) * variance))
  }
  return {
    max_hp:       vary(base.max_hp),
    attack:       vary(base.attack),
    defense:      vary(base.defense),
    strength:     vary(base.strength),
    agility:      vary(base.agility),
    intelligence: vary(base.intelligence),
  }
}

const TRAINING_ENEMY_POOLS = [
  { max:  3, names: ['Muñeco de Paja', 'Autómata de Madera', 'Espantapájaros Encantado', 'Golem de Barro', 'Aprendiz Rebelde'] },
  { max:  6, names: ['Espadachín Errante', 'Cazador Furtivo', 'Duelista Callejero', 'Mercenario Novato', 'Guerrero de Arena'] },
  { max: 10, names: ['Gladiador Veterano', 'Samurái Ronin', 'Valquiria de Bronce', 'Luchador de Foso', 'Maestro de Armas'] },
  { max: 20, names: ['Campeón de la Legión', 'Berserker del Norte', 'Mago de Guerra', 'Paladín Oscuro', 'Asesino de Élite', 'Druida Salvaje'] },
  { max: Infinity, names: ['Avatar de Combate', 'Espectro del Coliseo', 'El Invicto', 'Phantom del Torneo', 'Titán de Práctica', 'Sombra del Maestro'] },
]

/**
 * Nombre aleatorio del enemigo de práctica según nivel del héroe.
 */
export function trainingEnemyName(heroLevel) {
  const pool = TRAINING_ENEMY_POOLS.find(p => heroLevel <= p.max)?.names ?? TRAINING_ENEMY_POOLS[TRAINING_ENEMY_POOLS.length - 1].names
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Recompensas de combate rápido — ~18% de la torre para piso equivalente.
 */
export function trainingRewards(heroLevel) {
  const equivalentFloor = Math.max(1, Math.round(heroLevel * 1.2))
  const towerR = floorRewards(equivalentFloor)
  return {
    gold:       Math.max(5, Math.round(towerR.gold * 0.18)),
    experience: Math.max(3, Math.round(towerR.experience * 0.18)),
  }
}

/* ─── Expediciones: fórmulas de preview para DungeonCard ────────────────────── */

/**
 * Probabilidad de drop de equipo en una expedición.
 * Replica getDropConfig de _loot.js: chance = 0.10 + difficulty * 0.03
 * @param {number} difficulty  1-10
 * @param {number} dropRateBonus  bonus de equipo/research (itemDropRateBonus)
 * @param {number} lootBoostPct   poción loot_boost (0-1)
 * @returns {number} probabilidad 0-1
 */
export function itemDropChance(difficulty, dropRateBonus = 0, lootBoostPct = 0) {
  const base = 0.10 + Math.max(1, Math.min(10, difficulty)) * 0.03
  return Math.min(1, (base + dropRateBonus) * (1 + lootBoostPct))
}

/**
 * Probabilidad de drop de táctica en una expedición.
 * Base 12% + inteligencia (hasta +20%) + research bonus.
 * @param {number} intelligence  stat de inteligencia del héroe
 * @param {number} researchBonus  tactic_drop_pct de research
 * @returns {number} probabilidad 0-1
 */
export function tacticDropChance(intelligence = 0, researchBonus = 0) {
  const intellBonus = Math.min(0.20, (intelligence ?? 0) * 0.003)
  return Math.min(1, 0.12 + intellBonus + researchBonus)
}

/**
 * Pérdida de durabilidad estimada por expedición.
 * Replica la lógica de expedition-collect.js:
 *   base = 1 + floor(difficulty / 2)
 *   resultado = base - floor(defense / 15) + durabilityMod
 *   clamped a 0+, ajustado por research durability_loss_pct
 *
 * @param {number} difficulty    1-10
 * @param {number} defense       stat de defensa del héroe
 * @param {number} durabilityMod bonus/malus de tácticas equipadas
 * @param {number} researchPct   durability_loss_pct de research (negativo = reducción)
 * @returns {number} puntos de durabilidad perdidos
 */
export function durabilityLoss(difficulty, defense = 0, durabilityMod = 0, researchPct = 0) {
  const dangerBase = 1 + Math.floor((difficulty ?? 1) / 2)
  const raw = dangerBase - Math.floor(defense / 15) + durabilityMod
  return Math.max(0, Math.round(raw * (1 + researchPct)))
}

/**
 * Datos de material drops por nombre de mazmorra.
 * Espejo de MATERIAL_DROP_BY_NAME en api/_loot.js.
 * Usado por el frontend para mostrar probabilidad y cantidad en la card.
 */
export const MATERIAL_DROP_DATA = {
  'Guarida del Dragón':     { resource: 'essence',   chance: 0.20, min: 2, max: 3 },
  'Templo de los Antiguos': { resource: 'essence',   chance: 0.15, min: 1, max: 2 },
  'Abismo de las Almas':    { resource: 'fragments', chance: 0.18, min: 1, max: 2 },
  'Ruinas Encantadas':      { resource: 'fragments', chance: 0.12, min: 1, max: 1 },
  'Minas de Hierro Oscuro': { resource: 'fragments', chance: 0.20, min: 1, max: 3 },
}

/**
 * Descripción del loot principal por tipo de mazmorra.
 * El frontend usa esto para mostrar qué slots de equipo prioriza cada tipo.
 */
export const DUNGEON_LOOT_FOCUS = {
  combat:     { label: 'Combate',    slots: ['main_hand', 'off_hand'],             description: 'Armas y escudos' },
  wilderness: { label: 'Naturaleza', slots: ['legs', 'arms', 'accessory'],         description: 'Armadura ligera y accesorios' },
  magic:      { label: 'Arcana',     slots: ['accessory', 'helmet'],               description: 'Accesorios mágicos' },
  crypt:      { label: 'Cripta',     slots: ['off_hand', 'chest', 'helmet'],       description: 'Escudos y armadura pesada' },
  mine:       { label: 'Mina',       slots: ['arms', 'chest', 'main_hand'],        description: 'Armas y armadura de brazos' },
  ancient:    { label: 'Antigua',    slots: ['accessory', 'helmet', 'chest'],      description: 'Accesorios y yelmos antiguos' },
}
