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
    max_hp:      80  + fast * 15 + slow * 8,
    attack:       5  + fast * 2  + slow * 1,
    defense:      2  + fast * 1  + Math.floor(slow * 0.5),
    strength:     2  + Math.floor(fast * 0.5) + Math.floor(slow * 0.25),
    agility:      2  + Math.floor(fast * 0.3) + Math.floor(slow * 0.15),
    intelligence: 1  + Math.floor(fast * 0.3) + Math.floor(slow * 0.15),
  }
}

/**
 * Bonus de una carta de habilidad en rango `rank`.
 * Escala linealmente: baseValue × rank.
 */
export function cardBonusAtRank(baseValue, rank) {
  return baseValue * rank
}

/**
 * Penalización de una carta de habilidad en rango `rank`.
 * Escala linealmente igual que el bonus: baseValue × rank.
 * Rango 1 → ×1, Rango 2 → ×2, Rango 3 → ×3, Rango 4 → ×4, Rango 5 → ×5.
 *
 * No incluye Math.round — el llamador redondea si trabaja con enteros.
 * Para stats de porcentaje (ej. weapon_attack_amp = 0.15) no se redondea.
 */
export function cardPenaltyAtRank(baseValue, rank) {
  return baseValue * rank
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
 * Genera stats del enemigo de quick combat ancladas al poder real del héroe.
 * Usa las effective stats del jugador (base + equipo con desgaste + cartas +
 * runas + research) como ancla:
 *   - Factor de poder global 0.85–0.97 (el enemigo es un poco más débil en
 *     valor esperado → winrate objetivo ~60%).
 *   - Varianza individual por stat ±15% para que cada combate se sienta
 *     distinto y a veces el enemigo sorprenda con un stat puntual superior.
 *
 * Consecuencia directa: si el jugador tiene el equipo roto (durabilidad baja),
 * `getEffectiveStats` ya ha recortado sus bonos, y el enemigo se genera sobre
 * esos valores menores — el desgaste se propaga al balance automáticamente.
 */
export function trainingEnemyStatsFromPlayer(playerStats) {
  const powerFactor = 0.85 + Math.random() * 0.12   // 0.85 – 0.97
  function vary(v) {
    const variance = 0.85 + Math.random() * 0.30    // 0.85 – 1.15
    return Math.max(1, Math.round((v ?? 0) * powerFactor * variance))
  }
  return {
    max_hp:       vary(playerStats.max_hp),
    attack:       vary(playerStats.attack),
    defense:      vary(playerStats.defense),
    strength:     vary(playerStats.strength),
    agility:      vary(playerStats.agility),
    intelligence: vary(playerStats.intelligence),
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
