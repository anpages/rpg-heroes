/**
 * Constantes de diseño del juego — fuente de verdad única.
 * Importado tanto por el frontend (src/) como por la API (api/).
 *
 * REGLA: cualquier número que aparezca en la lógica de juego vive aquí.
 * El frontend y la API NUNCA definen sus propias versiones de estas fórmulas.
 */

// ── Edificios: nivel de base ──────────────────────────────────────────────────

/** Tipos de edificios que cuentan para el cálculo del nivel de base */
export const BASE_BUILDING_TYPES = [
  'energy_nexus', 'gold_mine', 'lumber_mill', 'mana_well', 'laboratory',
]

/**
 * Calcula el nivel de base a partir del array de edificios.
 * Cada edificio desbloqueado y con nivel > 0 contribuye al promedio.
 */
export function computeBaseLevel(buildings) {
  const byType = Object.fromEntries(buildings.map(b => [b.type, b]))
  const levels = BASE_BUILDING_TYPES.map(t =>
    (byType[t] && byType[t].unlocked !== false) ? (byType[t].level ?? 0) : 0
  )
  const active = levels.filter(l => l > 0)
  if (active.length === 0) return 1
  const avg = levels.reduce((a, b) => a + b, 0) / active.length
  // Math.round: base Nv2 se alcanza cuando el promedio ≥ 1.5
  // (ej: nexo Nv2 + aserradero Nv2 con mina y maná en Nv1 → avg=1.5 → Nv2)
  return Math.max(1, Math.round(avg))
}

// ── Árbol de desbloqueo ───────────────────────────────────────────────────────

/**
 * Al alcanzar `level` en el edificio `type`, se desbloquean los edificios en `unlocks`.
 * La API usa esto para activar desbloqueos; el frontend lo usa para mostrar requisitos.
 */
export const UNLOCK_TRIGGERS = [
  { type: 'energy_nexus', level: 2, unlocks: ['gold_mine', 'mana_well'] },
]

// ── Recursos iniciales ────────────────────────────────────────────────────────

/**
 * Recursos con los que arranca un jugador nuevo.
 * El Nexo Nv1→2 solo cuesta madera (wood:80), por lo que el iron inicial
 * queda disponible para las primeras mejoras del Aserradero.
 */
export const STARTING_RESOURCES = {
  gold:      200,
  wood:      120,
  iron:      80,
  mana:      0,
  gold_rate: 0,
  wood_rate: 0,
  iron_rate: 0,
  mana_rate: 0,
}

// ── Tasas de producción ───────────────────────────────────────────────────────

/**
 * Tasa BASE de hierro por nivel de Mina de Hierro, en unidades por HORA.
 * Nivel 1 → 30/h, nivel 2 → 48/h, nivel 3 → 66/h …
 */
export function ironRateForLevel(level) {
  return level > 0 ? Math.round((0.5 + (level - 1) * 0.3) * 60) : 0
}

/**
 * Tasa BASE de madera por nivel de Aserradero, en unidades por HORA.
 * Nivel 1 → 18/h, nivel 2 → 30/h, nivel 3 → 42/h …
 */
export function woodRateForLevel(level) {
  return level > 0 ? Math.round((0.3 + (level - 1) * 0.2) * 60) : 0
}

/**
 * Tasa BASE de maná por nivel de Pozo de Maná, en unidades por HORA.
 * Nivel 1 → 12/h, nivel 2 → 21/h, nivel 3 → 30/h …
 */
export function manaRateForLevel(level) {
  return level > 0 ? Math.round((0.2 + (level - 1) * 0.15) * 60) : 0
}

/**
 * Calcula las tasas de producción reales (unidades/HORA) aplicando el factor de energía.
 * Fuente de verdad para la API (building-upgrade-collect) y el frontend (display).
 * Los valores se redondean a entero para evitar decimales en la UI y en la BD.
 */
export function computeProductionRates(buildings) {
  const unlockedLevel = (type) => {
    const b = buildings.find(b => b.type === type)
    return (b && b.unlocked !== false) ? b.level : 0
  }

  const ironMine = unlockedLevel('gold_mine')
  const lumber   = unlockedLevel('lumber_mill')
  const mana     = unlockedLevel('mana_well')
  const nexus    = unlockedLevel('energy_nexus')

  const energyProduced = nexus * 30
  const energyConsumed = (ironMine + lumber + mana) * 10
  const ratio = energyConsumed > 0 ? Math.min(1, energyProduced / energyConsumed) : 1

  return {
    gold_rate: 0,
    iron_rate: ironMine > 0 ? Math.round(ironRateForLevel(ironMine) * ratio) : 0,
    wood_rate: lumber   > 0 ? Math.round(woodRateForLevel(lumber)   * ratio) : 0,
    mana_rate: mana     > 0 ? Math.round(manaRateForLevel(mana)     * ratio) : 0,
  }
}

// ── Edificios: costes y tiempos de mejora ─────────────────────────────────────

/**
 * Tiempo en ms para construir/mejorar un edificio desde el nivel `currentLevel`.
 * Nivel 0 (lab sin construir) usa el mismo tiempo que nivel 1.
 */
export function buildingUpgradeDurationMs(currentLevel) {
  const lvl = Math.max(1, currentLevel)
  return lvl * lvl * 10 * 60 * 1000
}

/**
 * Coste de subir el edificio `type` desde `currentLevel` al siguiente nivel.
 * Fuente de verdad para la API (building-upgrade-start) y el frontend (display).
 *
 * Nivel 0 = construcción inicial (solo lab, mina y pozo arrancan en 0).
 * Nivel máximo: BUILDING_MAX_LEVEL — la API rechaza subir más allá.
 */
export function buildingUpgradeCost(type, currentLevel) {
  switch (type) {
    case 'energy_nexus':
      // 1→2: solo madera (desbloquea la mina, no puede pedir hierro que aún no existe)
      if (currentLevel === 1) return { wood: 80 }
      // 2→5: mismos exponentes que el resto pero base mayor (es el edificio clave)
      return { wood: Math.round(75 * Math.pow(currentLevel, 1.5)), iron: Math.round(45 * Math.pow(currentLevel, 1.4)) }
    case 'lumber_mill':
      return { wood: Math.round(50 * Math.pow(currentLevel, 1.5)), iron: Math.round(30 * Math.pow(currentLevel, 1.4)) }
    case 'gold_mine':
      if (currentLevel === 0) return { wood: 60, iron: 30 }  // construcción inicial (hierro del stock inicial)
      return { wood: Math.round(45 * Math.pow(currentLevel, 1.5)), iron: Math.round(40 * Math.pow(currentLevel, 1.4)) }
    case 'mana_well':
      if (currentLevel === 0) return { wood: 60, iron: 40 }  // construcción inicial (ya hay mina activa)
      return { wood: Math.round(55 * Math.pow(currentLevel, 1.5)), iron: Math.round(35 * Math.pow(currentLevel, 1.4)), mana: Math.round(20 * Math.pow(currentLevel, 1.3)) }
    case 'laboratory':
      if (currentLevel === 0) return { wood: 80, iron: 50 }  // construcción inicial
      return { wood: Math.round(60 * Math.pow(currentLevel, 1.6)), iron: Math.round(50 * Math.pow(currentLevel, 1.5)), mana: Math.round(30 * Math.pow(currentLevel, 1.4)) }
    default:
      return { wood: Math.round(45 * Math.pow(currentLevel, 1.5)), iron: Math.round(40 * Math.pow(currentLevel, 1.4)) }
  }
}

/** Nivel de base mínimo requerido para construir el Laboratorio */
export const LAB_BASE_LEVEL_REQUIRED = 2

/** Nivel máximo de cualquier edificio de base */
export const BUILDING_MAX_LEVEL = 5

/** Nivel máximo de cualquier sala de entrenamiento */
export const TRAINING_ROOM_MAX_LEVEL = 5

// ── Salas de entrenamiento ────────────────────────────────────────────────────

/** Coste de construir cualquier sala de entrenamiento */
export const TRAINING_ROOM_BUILD_COST = { wood: 60, iron: 40 }

/** Tiempo de construcción de una sala de entrenamiento nueva */
export const TRAINING_ROOM_BUILD_TIME_MS = 10 * 60 * 1000

/** Tiempo de mejora de una sala de entrenamiento desde `currentLevel` */
export function trainingRoomUpgradeDurationMs(currentLevel) {
  return currentLevel * 5 * 60 * 1000
}

/** Coste de mejorar una sala de entrenamiento desde `currentLevel` */
export function trainingRoomUpgradeCost(currentLevel) {
  return {
    wood: Math.round(60 * Math.pow(currentLevel, 1.5)),
    iron: Math.round(50 * Math.pow(currentLevel, 1.4)),
  }
}

/**
 * Nivel de base mínimo requerido para CONSTRUIR cada sala de entrenamiento.
 * Las salas ya construidas no se ven afectadas al cambiar el nivel de base.
 */
export const TRAINING_ROOM_BASE_LEVEL_REQUIRED = {
  strength:     2,
  agility:      2,
  attack:       2,
  defense:      2,
  intelligence: 3,
}

// ── Onboarding: estado inicial de edificios ───────────────────────────────────

/**
 * Lista completa de tipos de edificio que se crean al registrar un jugador.
 * Idéntica a BASE_BUILDING_TYPES — exportada con nombre semántico para onboarding.
 */
export const ALL_BUILDING_TYPES = [...BASE_BUILDING_TYPES]

/**
 * Edificios desbloqueados desde el inicio.
 * Derivado de UNLOCK_TRIGGERS: todo lo que NO es objetivo de un trigger está
 * disponible desde el comienzo.
 */
const TRIGGER_LOCKED = new Set(UNLOCK_TRIGGERS.flatMap(t => t.unlocks))
export const INITIALLY_UNLOCKED_BUILDINGS = ALL_BUILDING_TYPES.filter(t => !TRIGGER_LOCKED.has(t))
// Resultado: ['energy_nexus', 'lumber_mill', 'laboratory']

// ── Inventario ───────────────────────────────────────────────────────────────

/** Slots de mochila base sin mejoras de taller */
export const INVENTORY_BASE_LIMIT = 20

/** Slots adicionales de mochila por nivel de taller */
export const INVENTORY_PER_WORKSHOP_LEVEL = 5

// ── Cartas de habilidad ───────────────────────────────────────────────────────

/** Número máximo de cartas equipadas simultáneamente */
export const CARD_SLOT_COUNT = 5

/** Rango máximo de una carta de habilidad */
export const CARD_MAX_RANK = 5

// ── Reparación y desmantelamiento de ítems ────────────────────────────────────

/**
 * Coste base por punto de durabilidad restaurado, según rareza del ítem.
 * La API aplica además el descuento por nivel de herrería.
 * El frontend usa estos valores como estimación para el diálogo de confirmación.
 */
export const REPAIR_COST_TABLE = {
  common:    { gold: 2,  mana: 0  },
  uncommon:  { gold: 3,  mana: 1  },
  rare:      { gold: 5,  mana: 3  },
  epic:      { gold: 8,  mana: 6  },
  legendary: { gold: 12, mana: 10 },
}

/**
 * Maná base recuperado al desmantelar un ítem, multiplicado por el tier.
 * `maná = DISMANTLE_MANA_TABLE[rarity] * tier`
 */
export const DISMANTLE_MANA_TABLE = {
  common:    3,
  uncommon:  8,
  rare:      20,
  epic:      50,
  legendary: 120,
}

// ── Entrenamiento: XP ─────────────────────────────────────────────────────────

/** Horas máximas de XP acumulable sin recoger (cap anti-AFK) */
export const TRAINING_XP_CAP_HOURS = 24

/** XP generada por hora según nivel de sala (Nv1 → 1/h, Nv2 → 1.5/h, …) */
export function xpRateForLevel(roomLevel) {
  return 0.5 + roomLevel * 0.5
}

/** XP necesaria para el siguiente +1 al stat dado cuántos puntos ya se ganaron */
export function xpThreshold(totalGained) {
  return Math.round(10 * Math.pow(1.5, totalGained))
}
