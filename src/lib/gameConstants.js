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
  const total = levels.reduce((a, b) => a + b, 0)
  if (total === 0) return 1
  // Divisor fijo 4: agregar un edificio nuevo siempre mantiene o sube el nivel,
  // nunca lo baja (a diferencia de dividir por edificios activos, que varía).
  return Math.max(1, Math.ceil(total / 4))
}

// ── Árbol de desbloqueo ───────────────────────────────────────────────────────

/**
 * Al alcanzar `level` en el edificio `type`, se desbloquean los edificios en `unlocks`.
 * La API usa esto para activar desbloqueos; el frontend lo usa para mostrar requisitos.
 */
export const UNLOCK_TRIGGERS = [
  { type: 'energy_nexus', level: 2, unlocks: ['gold_mine', 'mana_well'] },
  { type: 'laboratory',   level: 2, unlocks: ['library'] },
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
 * Recurso escaso y valioso — siempre inferior a madera al mismo nivel.
 * Nivel 1 → 18/h, nivel 2 → 30/h, nivel 3 → 42/h …
 */
export function ironRateForLevel(level) {
  return level > 0 ? Math.round((0.3 + (level - 1) * 0.2) * 60) : 0
}

/**
 * Tasa BASE de madera por nivel de Aserradero, en unidades por HORA.
 * Recurso abundante — siempre superior a hierro al mismo nivel.
 * Nivel 1 → 30/h, nivel 2 → 48/h, nivel 3 → 66/h …
 */
export function woodRateForLevel(level) {
  return level > 0 ? Math.round((0.5 + (level - 1) * 0.3) * 60) : 0
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
 * Tiempo base en minutos por tipo de edificio.
 * La fórmula final es: nivel² × base_minutos.
 * Los edificios de alto nivel (lab, biblioteca) tienen base mayor para reflejar su importancia.
 */
const BUILDING_BASE_TIME_MINUTES = {
  lumber_mill:   8,   // recurso básico, se mejora frecuentemente
  gold_mine:    10,   // recurso fundamental
  mana_well:    12,   // recurso especial
  energy_nexus: 15,   // hub central, crítico para todo
  laboratory:   20,   // edificio de alto nivel (requiere Base Nv3)
  library:      30,   // edificio final (requiere Lab Nv2 + Base Nv3)
}

/**
 * Tiempo en ms para construir/mejorar un edificio desde el nivel `currentLevel`.
 * Nivel 0 (lab sin construir) usa el mismo tiempo que nivel 1.
 * @param {number} currentLevel
 * @param {string} buildingType
 */
export function buildingUpgradeDurationMs(currentLevel, buildingType) {
  const lvl = Math.max(1, currentLevel)
  const baseMin = BUILDING_BASE_TIME_MINUTES[buildingType] ?? 10
  return lvl * lvl * baseMin * 60 * 1000
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
      return { wood: Math.round(75 * Math.pow(currentLevel, 1.5)), iron: Math.round(17 * Math.pow(currentLevel, 1.4)) }
    case 'lumber_mill':
      return { wood: Math.round(50 * Math.pow(currentLevel, 1.5)), iron: Math.round(12 * Math.pow(currentLevel, 1.4)) }
    case 'gold_mine':
      if (currentLevel === 0) return { wood: 60, iron: 12 }
      return { wood: Math.round(45 * Math.pow(currentLevel, 1.5)), iron: Math.round(13 * Math.pow(currentLevel, 1.4)) }
    case 'mana_well':
      if (currentLevel === 0) return { wood: 60, iron: 15 }
      return { wood: Math.round(55 * Math.pow(currentLevel, 1.5)), iron: Math.round(13 * Math.pow(currentLevel, 1.4)), mana: Math.round(20 * Math.pow(currentLevel, 1.3)) }
    case 'laboratory':
      if (currentLevel === 0) return { wood: 80, iron: 21 }
      return { wood: Math.round(60 * Math.pow(currentLevel, 1.6)), iron: Math.round(18 * Math.pow(currentLevel, 1.5)), mana: Math.round(30 * Math.pow(currentLevel, 1.4)) }
    case 'library':
      if (currentLevel === 0) return { wood: 100, iron: 27,  mana: 30  }
      if (currentLevel === 1) return { wood: 180, iron: 48,  mana: 70  }
      if (currentLevel === 2) return { wood: 340, iron: 90,  mana: 150 }
      if (currentLevel === 3) return { wood: 560, iron: 150, mana: 270 }
      return                          { wood: 850, iron: 228, mana: 420 }
    default:
      return { wood: Math.round(45 * Math.pow(currentLevel, 1.5)), iron: Math.round(13 * Math.pow(currentLevel, 1.4)) }
  }
}

/** Nivel de base mínimo requerido para construir el Laboratorio */
export const LAB_BASE_LEVEL_REQUIRED = 3

/** Nivel de base mínimo requerido para construir la Biblioteca (además de Lab Nv2) */
export const LIBRARY_BASE_LEVEL_REQUIRED = 3

/** Nivel máximo de cualquier edificio de base */
export const BUILDING_MAX_LEVEL = 5

/** Nivel máximo de cualquier sala de entrenamiento */
export const TRAINING_ROOM_MAX_LEVEL = 5

// ── Salas de entrenamiento ────────────────────────────────────────────────────

/** Coste de construir cualquier sala de entrenamiento */
export const TRAINING_ROOM_BUILD_COST = { wood: 60, iron: 15 }

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
    iron: Math.round(17 * Math.pow(currentLevel, 1.4)),
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
 * Incluye los edificios de base más library, que arranca bloqueada.
 */
export const ALL_BUILDING_TYPES = [...BASE_BUILDING_TYPES, 'library']

/**
 * Edificios desbloqueados desde el inicio.
 * Derivado de UNLOCK_TRIGGERS: todo lo que NO es objetivo de un trigger está
 * disponible desde el comienzo.
 */
const TRIGGER_LOCKED = new Set(UNLOCK_TRIGGERS.flatMap(t => t.unlocks))
export const INITIALLY_UNLOCKED_BUILDINGS = ALL_BUILDING_TYPES.filter(t => !TRIGGER_LOCKED.has(t))
// Resultado: ['energy_nexus', 'lumber_mill', 'laboratory']

// ── Inventario ───────────────────────────────────────────────────────────────

/** Slots de mochila */
export const INVENTORY_BASE_LIMIT = 20

/** Slots extra por cada ampliación de mochila */
export const BAG_SLOTS_PER_UPGRADE = 5

/** Coste en oro de cada ampliación (índice = nivel actual de ampliación) */
export const BAG_UPGRADE_COSTS = [500, 1500, 4000, 10000, 25000]

/** Nivel máximo de ampliación de mochila */
export const BAG_MAX_UPGRADES = BAG_UPGRADE_COSTS.length

// ── Cartas de habilidad ───────────────────────────────────────────────────────

/** Número máximo de cartas equipadas simultáneamente */
export const CARD_SLOT_COUNT = 5

/** Rango máximo de una carta de habilidad */
export const CARD_MAX_RANK = 5

// ── Runas ─────────────────────────────────────────────────────────────────────

/** Slots de runa base por ítem equipado (fijo, sin Herrería). */
export const BASE_RUNE_SLOTS = 1

/** Nivel mínimo de Laboratorio para craftear cualquier runa */
export const RUNE_MIN_LAB_LEVEL = 2

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
 * Oro base obtenido al desmantelar un ítem, multiplicado por el tier.
 * `oro = DISMANTLE_GOLD_TABLE[rarity] * tier`
 */
export const DISMANTLE_GOLD_TABLE = {
  common:    10,
  uncommon:  25,
  rare:      60,
  epic:      150,
  legendary: 400,
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
  return Math.round(10 * Math.pow(1.3, totalGained))
}

// ── Árbol de investigación ────────────────────────────────────────────────────

/**
 * 16 nodos de investigación en 4 ramas: combat, expedition, crafting, magic.
 * Cada nodo tiene un efecto que se aplica a nivel de juego cuando está completado.
 * Fuente de verdad para la API (_research.js) y el frontend (BibliotecaZone).
 */
export const RESEARCH_NODES = [
  // Combat
  { id: 'combat_1',     branch: 'combat',     position: 1, library_level_required: 1, name: 'Técnica de Ataque',     description: '+5% al ataque base.',                                    effect_type: 'attack_pct',          effect_value: 0.05,  cost: { gold: 100,  iron: 60,  mana: 30  }, duration_hours: 4   },
  { id: 'combat_2',     branch: 'combat',     position: 2, library_level_required: 2, name: 'Postura Defensiva',     description: '+5% a la defensa base.',                                 effect_type: 'defense_pct',         effect_value: 0.05,  cost: { gold: 200,  iron: 120, mana: 80  }, duration_hours: 12,  prerequisite: 'combat_1' },
  { id: 'combat_3',     branch: 'combat',     position: 3, library_level_required: 3, name: 'Golpe Crítico',         description: '+3% probabilidad de crítico.',                           effect_type: 'crit_pct',            effect_value: 0.03,  cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'combat_2' },
  { id: 'combat_4',     branch: 'combat',     position: 4, library_level_required: 5, name: 'Maestría en Combate',   description: '+10% al daño en la Torre.',                              effect_type: 'tower_dmg_pct',       effect_value: 0.10,  cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'combat_3' },
  // Expedition
  { id: 'expedition_1', branch: 'expedition', position: 1, library_level_required: 1, name: 'Saqueo Eficiente',      description: '+5% al oro de expediciones.',                            effect_type: 'expedition_gold_pct', effect_value: 0.05,  cost: { gold: 100,  iron: 60,  mana: 30  }, duration_hours: 4   },
  { id: 'expedition_2', branch: 'expedition', position: 2, library_level_required: 2, name: 'Mantenimiento',         description: '-10% al desgaste de equipo en expediciones.',            effect_type: 'durability_loss_pct', effect_value: -0.10, cost: { gold: 200,  iron: 120, mana: 80  }, duration_hours: 12,  prerequisite: 'expedition_1' },
  { id: 'expedition_3', branch: 'expedition', position: 3, library_level_required: 3, name: 'Aprendizaje Acelerado', description: '+5% a la XP de expediciones.',                           effect_type: 'expedition_xp_pct',   effect_value: 0.05,  cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'expedition_2' },
  { id: 'expedition_4', branch: 'expedition', position: 4, library_level_required: 5, name: 'Doble Expedición',      description: 'Permite enviar un héroe a dos expediciones simultáneas.', effect_type: 'expedition_slots',    effect_value: 1,     cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'expedition_3' },
  // Crafting
  { id: 'crafting_1',   branch: 'crafting',   position: 1, library_level_required: 1, name: 'Técnicas de Reparación',description: '-10% al coste de reparación.',                          effect_type: 'repair_cost_pct',     effect_value: -0.10, cost: { gold: 100,  iron: 60,  mana: 30  }, duration_hours: 4   },
  { id: 'crafting_2',   branch: 'crafting',   position: 2, library_level_required: 2, name: 'Ojo de Buitre',         description: '+5% a la tasa de drop de ítems.',                       effect_type: 'item_drop_pct',       effect_value: 0.05,  cost: { gold: 200,  iron: 120, mana: 80  }, duration_hours: 12,  prerequisite: 'crafting_1' },
  { id: 'crafting_3',   branch: 'crafting',   position: 3, library_level_required: 3, name: 'Grabado Profundo',      description: 'Desbloquea un 3er slot de runa en todos los ítems.',     effect_type: 'rune_slot_bonus',     effect_value: 1,     cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'crafting_2' },
  { id: 'crafting_4',   branch: 'crafting',   position: 4, library_level_required: 5, name: 'Artesano Supremo',      description: 'Reduce en 1 el nivel de Lab necesario para craftear runas.',effect_type: 'lab_req_reduction', effect_value: 1,     cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'crafting_3' },
  // Magic
  { id: 'magic_1',      branch: 'magic',      position: 1, library_level_required: 1, name: 'Estudios Arcanos',      description: '+5% a la inteligencia base.',                            effect_type: 'intelligence_pct',    effect_value: 0.05,  cost: { gold: 100,  iron: 60,  mana: 30  }, duration_hours: 4   },
  { id: 'magic_2',      branch: 'magic',      position: 2, library_level_required: 2, name: 'Canalización Arcana',   description: '+5% a la producción de maná.',                           effect_type: 'mana_rate_pct',       effect_value: 0.05,  cost: { gold: 200,  iron: 120, mana: 80  }, duration_hours: 12,  prerequisite: 'magic_1' },
  { id: 'magic_3',      branch: 'magic',      position: 3, library_level_required: 3, name: 'Fusión Rúnica',         description: '-10% al coste de fusión de cartas.',                     effect_type: 'fusion_cost_pct',     effect_value: -0.10, cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'magic_2' },
  { id: 'magic_4',      branch: 'magic',      position: 4, library_level_required: 5, name: 'Resonancia Rúnica',     description: '+10% a los bonos de runas.',                             effect_type: 'enchantment_amp',     effect_value: 0.10,  cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'magic_3' },
]

/**
 * Calcula bonos de investigación a partir de la lista de IDs completados.
 * Uso en el frontend para mostrar desglose sin llamar al backend.
 */
export function computeResearchBonuses(completedIds = []) {
  const set = new Set(completedIds)
  const bonuses = {}
  for (const node of RESEARCH_NODES) {
    if (set.has(node.id)) {
      bonuses[node.effect_type] = (bonuses[node.effect_type] ?? 0) + node.effect_value
    }
  }
  return bonuses
}

/** Costes de mejora de tier. key = tier actual → siguiente.
 *  Requiere oro + fragmentos (drops físicos) + esencia (drops mágicos). */
export const ITEM_TIER_UPGRADE_COST = {
  1: { gold: 150, fragments: 5,  essence: 2 },
  2: { gold: 350, fragments: 15, essence: 6 },
}

// ── Héroes ────────────────────────────────────────────────────────────────────

/** Nivel mínimo de Base requerido para cada slot de héroe adicional. */
export const HERO_SLOT_REQUIREMENTS = { 2: 4, 3: 5 }

// ── Pociones ─────────────────────────────────────────────────────────────────

/** Máximo de unidades de una misma poción que puede tener un héroe. */
export const MAX_POTION_STACK = 5
/** Duración del crafteo de una poción en milisegundos. */
export const POTION_CRAFT_DURATION_MS = 30 * 60 * 1000
/** Duración del crafteo de una runa en milisegundos. */
export const RUNE_CRAFT_DURATION_MS   = 60 * 60 * 1000  // 1 hora

// ── Entrenamiento ─────────────────────────────────────────────────────────────

/** Stats válidas para salas de entrenamiento. */
export const TRAINING_ROOM_STATS = ['strength', 'agility', 'attack', 'defense', 'intelligence']
