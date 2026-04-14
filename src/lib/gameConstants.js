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
  'gold_mine', 'lumber_mill', 'mana_well', 'laboratory',
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
  // Divisor fijo 4: mantiene consistencia con el diseño original.
  return Math.max(1, Math.ceil(total / 4))
}

// ── Árbol de desbloqueo ───────────────────────────────────────────────────────

/**
 * Al alcanzar `level` en el edificio `type`, se desbloquean los edificios en `unlocks`.
 * La API usa esto para activar desbloqueos; el frontend lo usa para mostrar requisitos.
 */
export const UNLOCK_TRIGGERS = [
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
 * Sistema de producción idle: cada edificio produce a un rate fijo por nivel
 * y almacena hasta un cap. El jugador recolecta manualmente.
 * Sin nexo de energía — cada edificio funciona independientemente.
 *
 * ratePerHour[i] = rate al nivel i+1. Sin cap — se acumula sin límite.
 */
export const BUILDING_PRODUCTION = {
  // cap fijo por edificio → mayor nivel llena más rápido
  // gold_mine:  L1=4h, L5=1h
  // lumber_mill: L1=6h, L5=1.5h
  // mana_well:  L1=12.75h, L5=3h   (recurso escaso, ritmo lento)
  // herb_garden: L1=8h, L5=1.9h
  gold_mine:   { resource: 'iron',  ratePerHour: [12, 17, 24, 34, 48], cap: 48  },
  lumber_mill: { resource: 'wood',  ratePerHour: [15, 21, 30, 42, 60], cap: 90  },
  herb_garden: { resource: 'herbs', ratePerHour: [8,  12, 17, 24, 34], cap: 64  },
  mana_well:   { resource: 'mana',  ratePerHour: [8,  12, 17, 24, 34], cap: 102 },
}

/** Tipos de edificio productivo (los que se recolectan). */
export const PRODUCTION_BUILDING_TYPES = Object.keys(BUILDING_PRODUCTION)

/**
 * Rate y cap de un edificio productivo dado su nivel.
 * Cap es fijo por tipo de edificio — a mayor nivel, menor tiempo para llenarse.
 */
export function buildingRate(type, level) {
  const prod = BUILDING_PRODUCTION[type]
  if (!prod || level <= 0) return { resource: prod?.resource ?? 'iron', rate: 0, cap: 0 }
  const idx = Math.min(level - 1, prod.ratePerHour.length - 1)
  const rate = prod.ratePerHour[idx]
  return { resource: prod.resource, rate, cap: prod.cap }
}
/** @deprecated alias para compatibilidad — usar buildingRate */
export const buildingRateAndCap = buildingRate

/** Slots de crafteo disponibles (base 2, expansible con investigación). */
export const CRAFTING_SLOTS_BASE = 2

/** Tipos de edificio de refinado */
export const REFINING_BUILDING_TYPES = ['carpinteria', 'fundicion', 'destileria_arcana', 'herbolario']

/** Slots de refinado por edificio (1 base, 2 a nivel 4+) */
export const REFINING_SLOTS_BASE = 1
export const REFINING_SLOTS_EXPANDED_LEVEL = 4

/** Bonus de velocidad de refinado: 15% más rápido por cada nivel por encima del mínimo de la receta */
export const REFINING_SPEED_BONUS_PER_LEVEL = 0.15

/** Calcula los minutos efectivos de una receta según el nivel del edificio */
export function refiningCraftMinutes(recipeCraftMinutes, recipeMinLevel, buildingLevel) {
  const levelsAbove = Math.max(0, buildingLevel - recipeMinLevel)
  const multiplier = Math.max(0.4, 1 - levelsAbove * REFINING_SPEED_BONUS_PER_LEVEL)
  return Math.round(recipeCraftMinutes * multiplier * 10) / 10
}

// ── Edificios: costes y tiempos de mejora ─────────────────────────────────────

/**
 * Tiempo base en minutos por tipo de edificio.
 * La fórmula final es: nivel² × base_minutos.
 * Los edificios de alto nivel (lab, biblioteca) tienen base mayor para reflejar su importancia.
 */
const BUILDING_BASE_TIME_MINUTES = {
  lumber_mill:       8,   // recurso básico, se mejora frecuentemente
  gold_mine:        10,   // recurso fundamental
  mana_well:        12,   // recurso especial
  herb_garden:      10,   // jardín de hierbas (requiere Base Nv2)
  carpinteria:       8,   // refinado de madera
  fundicion:        10,   // refinado de mineral
  destileria_arcana:12,   // refinado de maná
  herbolario:       10,   // refinado de hierbas
  laboratory:       20,   // edificio de alto nivel (requiere Base Nv3)
  library:          30,   // edificio final (requiere Lab Nv2 + Base Nv3)
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
    case 'lumber_mill':
      return { wood: Math.round(50 * Math.pow(currentLevel, 1.5)), iron: Math.round(25 * Math.pow(currentLevel, 1.4)) }
    case 'gold_mine':
      if (currentLevel === 0) return { wood: 60, iron: 25 }
      return { wood: Math.round(45 * Math.pow(currentLevel, 1.5)), iron: Math.round(22 * Math.pow(currentLevel, 1.4)) }
    case 'mana_well':
      if (currentLevel === 0) return { wood: 60, iron: 30 }
      return { wood: Math.round(55 * Math.pow(currentLevel, 1.5)), iron: Math.round(25 * Math.pow(currentLevel, 1.4)), mana: Math.round(20 * Math.pow(currentLevel, 1.3)) }
    case 'herb_garden':
      if (currentLevel === 0) return { wood: 50, iron: 25 }
      return {
        wood:  Math.round(45 * Math.pow(currentLevel, 1.5)),
        iron:  Math.round(20 * Math.pow(currentLevel, 1.4)),
        ...(currentLevel >= 2 && { herbs: currentLevel * 12 }),
      }
    case 'carpinteria':
      if (currentLevel === 0) return { wood: 40, iron: 20 }
      return { wood: Math.round(40 * Math.pow(currentLevel, 1.5)), iron: Math.round(20 * Math.pow(currentLevel, 1.4)) }
    case 'fundicion':
      if (currentLevel === 0) return { wood: 45, iron: 25 }
      return { wood: Math.round(45 * Math.pow(currentLevel, 1.5)), iron: Math.round(25 * Math.pow(currentLevel, 1.4)) }
    case 'destileria_arcana':
      if (currentLevel === 0) return { wood: 50, iron: 25, mana: 15 }
      return { wood: Math.round(50 * Math.pow(currentLevel, 1.5)), iron: Math.round(22 * Math.pow(currentLevel, 1.4)), mana: Math.round(15 * Math.pow(currentLevel, 1.3)) }
    case 'herbolario':
      if (currentLevel === 0) return { wood: 45, iron: 20 }
      return { wood: Math.round(40 * Math.pow(currentLevel, 1.5)), iron: Math.round(18 * Math.pow(currentLevel, 1.4)) }
    case 'laboratory':
      if (currentLevel === 0) return { wood: 80, iron: 35 }
      return { wood: Math.round(60 * Math.pow(currentLevel, 1.6)), iron: Math.round(30 * Math.pow(currentLevel, 1.5)), mana: Math.round(30 * Math.pow(currentLevel, 1.4)) }
    case 'library':
      if (currentLevel === 0) return { wood: 100, iron: 45,  mana: 30  }
      if (currentLevel === 1) return { wood: 180, iron: 80,  mana: 70  }
      if (currentLevel === 2) return { wood: 340, iron: 150, mana: 150 }
      if (currentLevel === 3) return { wood: 560, iron: 250, mana: 270 }
      return                          { wood: 850, iron: 380, mana: 420 }
    default:
      return { wood: Math.round(45 * Math.pow(currentLevel, 1.5)), iron: Math.round(22 * Math.pow(currentLevel, 1.4)) }
  }
}

/** Nivel de base mínimo requerido para construir el Jardín de Hierbas */
export const HERB_GARDEN_BASE_LEVEL_REQUIRED = 2

/** Nivel de base mínimo requerido para construir la Destilería Arcana */
export const DESTILERIA_BASE_LEVEL_REQUIRED = 2

/** Nivel de base mínimo requerido para construir el Herbolario */
export const HERBOLARIO_BASE_LEVEL_REQUIRED = 2

/** Nivel de base mínimo requerido para construir el Laboratorio */
export const LAB_BASE_LEVEL_REQUIRED = 3

/** Nivel de base mínimo requerido para construir la Biblioteca (además de Lab Nv2) */
export const LIBRARY_BASE_LEVEL_REQUIRED = 3

/** Nivel máximo de cualquier edificio de base */
export const BUILDING_MAX_LEVEL = 5

/** Edificios de refinado y taller solo tienen nivel 1 (construir = desbloquear) */
export const REFINING_MAX_LEVEL = 1
export const LAB_MAX_LEVEL = 1

/** Nivel máximo de cualquier sala de entrenamiento */
export const TRAINING_ROOM_MAX_LEVEL = 5

// ── Salas de entrenamiento ────────────────────────────────────────────────────

/** Coste de construir cualquier sala de entrenamiento */
export const TRAINING_ROOM_BUILD_COST = { wood: 60, iron: 30 }

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
    iron: Math.round(30 * Math.pow(currentLevel, 1.4)),
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
  max_hp:       2,
  intelligence: 3,
}

// ── Onboarding: estado inicial de edificios ───────────────────────────────────

/**
 * Lista completa de tipos de edificio que se crean al registrar un jugador.
 * Incluye los edificios de base más library, que arranca bloqueada.
 */
export const ALL_BUILDING_TYPES = [...BASE_BUILDING_TYPES, 'library', 'herb_garden', ...REFINING_BUILDING_TYPES]

/**
 * Edificios desbloqueados desde el inicio.
 * Derivado de UNLOCK_TRIGGERS: todo lo que NO es objetivo de un trigger está
 * disponible desde el comienzo.
 */
const TRIGGER_LOCKED = new Set(UNLOCK_TRIGGERS.flatMap(t => t.unlocks))
export const INITIALLY_UNLOCKED_BUILDINGS = ALL_BUILDING_TYPES.filter(t => !TRIGGER_LOCKED.has(t))

/**
 * Edificios que empiezan en nivel 0 aunque estén desbloqueados.
 * El jugador los construye manualmente cuando cumple el requisito de base level.
 */
export const STARTS_AT_LEVEL_ZERO = new Set(['laboratory', 'destileria_arcana', 'herbolario'])

// ── Inventario ───────────────────────────────────────────────────────────────

/** Slots de mochila */
export const INVENTORY_BASE_LIMIT = 20

/** Slots extra por cada ampliación de mochila */
export const BAG_SLOTS_PER_UPGRADE = 5

/** Coste en oro de cada ampliación (índice = nivel actual de ampliación) */
export const BAG_UPGRADE_COSTS = [500, 1500, 4000, 10000, 25000]

/** Nivel máximo de ampliación de mochila */
export const BAG_MAX_UPGRADES = BAG_UPGRADE_COSTS.length

// ── Tácticas ─────────────────────────────────────────────────────────────────

/** Número de slots de tácticas por héroe */
export const TACTIC_SLOT_COUNT = 5

/** Nivel máximo de una táctica (base, sin investigación) */
export const TACTIC_MAX_LEVEL = 5

/** Coste en oro por cambiar una táctica de slot (mover de un slot a otro) */
export const TACTIC_SWAP_COST = 50

// ── Reparación y desmantelamiento de ítems ────────────────────────────────────

/**
 * Coste base por punto de durabilidad restaurado, según rareza del ítem.
 * La API aplica además el descuento por nivel de herrería.
 * El frontend usa estos valores como estimación para el diálogo de confirmación.
 */
export const REPAIR_COST_TABLE = {
  common:    { gold: 5,  mana: 0 },
  uncommon:  { gold: 11, mana: 0 },
  rare:      { gold: 20, mana: 1 },
  epic:      { gold: 32, mana: 3 },
  legendary: { gold: 50, mana: 5 },
}

/**
 * Iron consumido por punto de durabilidad reparado, según rareza.
 * Común no pide iron — el early game sigue con gold puro. A partir de
 * uncommon cada reparación consume iron, que escala fuerte con rareza.
 * Diseñado para dar sumidero recurrente a la producción de la mina.
 */
export const REPAIR_IRON_BY_RARITY = {
  common:    0,
  uncommon:  1,
  rare:      2,
  epic:      5,
  legendary: 8,
}

/**
 * Multiplicador de iron por slot. Las armas (metal pesado) consumen más,
 * las armaduras estándar, los accesorios son mágicos → solo mana, 0 iron.
 */
export const REPAIR_IRON_SLOT_MULT = {
  main_hand: 1.5,
  off_hand:  1.2,
  helmet:    1.0,
  chest:     1.0,
  arms:      1.0,
  legs:      1.0,
  feet:      1.0,
  accessory: 0,
}

/**
 * Recursos base obtenidos al desmantelar un ítem.
 * Todos los valores se multiplican × tier del ítem.
 * Adicionalmente, cada runa aplicada suma: gold +8, mana +5.
 */
export const DISMANTLE_TABLE = {
  common:    { gold: 15,  mana: 0,  fragments: 0,  essence: 0 },
  uncommon:  { gold: 30,  mana: 4,  fragments: 0,  essence: 0 },
  rare:      { gold: 70,  mana: 10, fragments: 2,  essence: 0 },
  epic:      { gold: 180, mana: 25, fragments: 6,  essence: 2 },
  legendary: { gold: 450, mana: 60, fragments: 15, essence: 5 },
}

/** Bonus por cada runa aplicada al desmantelar */
export const DISMANTLE_RUNE_BONUS = { gold: 8, mana: 5 }

// Aliases legacy — se mantienen para no romper referencias antiguas
/** @deprecated usar DISMANTLE_TABLE */
export const DISMANTLE_GOLD_TABLE = {
  common: 15, uncommon: 30, rare: 70, epic: 180, legendary: 450,
}

// ── Entrenamiento: XP ─────────────────────────────────────────────────────────

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
  { id: 'crafting_3',   branch: 'crafting',   position: 3, library_level_required: 3, name: 'Táctico Nato',          description: '+5% a la probabilidad de obtener tácticas.',             effect_type: 'tactic_drop_pct',     effect_value: 0.05,  cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'crafting_2' },
  { id: 'crafting_4',   branch: 'crafting',   position: 4, library_level_required: 5, name: 'Maestro de Tácticas',   description: '-50% al coste de cambiar tácticas de slot.',             effect_type: 'tactic_swap_discount',effect_value: 0.50,  cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'crafting_3' },
  // Magic
  { id: 'magic_1',      branch: 'magic',      position: 1, library_level_required: 1, name: 'Estudios Arcanos',      description: '+5% a la inteligencia base.',                            effect_type: 'intelligence_pct',    effect_value: 0.05,  cost: { gold: 100,  iron: 60,  mana: 30  }, duration_hours: 4   },
  { id: 'magic_2',      branch: 'magic',      position: 2, library_level_required: 2, name: 'Canalización Arcana',   description: '+5% a la producción de maná.',                           effect_type: 'mana_rate_pct',       effect_value: 0.05,  cost: { gold: 200,  iron: 120, mana: 80  }, duration_hours: 12,  prerequisite: 'magic_1' },
  { id: 'magic_3',      branch: 'magic',      position: 3, library_level_required: 3, name: 'Resonancia Táctica',    description: '+5% a la efectividad de los bonos de tácticas.',         effect_type: 'tactic_bonus_pct',    effect_value: 0.05,  cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'magic_2' },
  { id: 'magic_4',      branch: 'magic',      position: 4, library_level_required: 5, name: 'Dominio Táctico',       description: '+1 al nivel máximo de tácticas (6 en vez de 5).',        effect_type: 'tactic_max_level_bonus',effect_value: 1,   cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'magic_3' },
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

// ── Héroes ────────────────────────────────────────────────────────────────────

/** Nivel mínimo de Base requerido para cada slot de héroe adicional. */
export const HERO_SLOT_REQUIREMENTS = { 2: 4, 3: 5 }

// ── Coste de HP en combate ────────────────────────────────────────────────────

/**
 * Coste plano de HP por actividad de combate, como fracción de hero.max_hp.
 *
 * El combate siempre se simula con max_hp del héroe (cada duelo es independiente).
 * Tras el duelo se deduce un coste fijo del HP actual, distinto si gana o pierde.
 *
 * Objetivo de balance: ~10 actividades por sesión llena (100% HP),
 * con margen para perder algunas. El HP se regenera al 100% por hora cuando
 * el héroe está idle, así que sesiones consecutivas no se penalizan.
 */
export const COMBAT_HP_COST = {
  quick:      { win: 0.10, loss: 0.18 },
  tournament: { win: 0.08, loss: 0.14 },
  tower:      { win: 0.10, loss: 0.17 },
  squad:      { win: 0.12, loss: 0.20 },
}

/**
 * Desgaste base de equipo por actividad. Los valores son "cantidad nominal"
 * — la función SQL `reduce_equipment_durability_scaled` los multiplica luego
 * por rareza × slot del ítem para escalar por calidad del equipo.
 *
 * Expedición NO está aquí: usa su propia fórmula dinámica (peligro + defensa
 * + cartas + research) en expedition-collect.js, ya suficientemente granular.
 */
export const WEAR_PROFILE = {
  quick:      { crush: 0, fair: 1, clutch: 2, loss: 2 },
  tournament: { 1: 2, 2: 3, 3: 4 },              // por ronda (1, 2, 3=final)
  squad:      2,                                 // aplicado a cada uno de los 3 héroes
  bounty:     2,                                 // caza de botín — aplicado por intento
}

/**
 * Desgaste de un piso de torre (escalonado por tramo).
 * Helper que encapsula la regla inline que antes vivía en _towerFinalize.js.
 */
export function towerWearForFloor(floor) {
  if (floor <= 10) return 1
  if (floor <= 25) return 2
  if (floor <= 40) return 3
  return 4
}


// ── Pociones ─────────────────────────────────────────────────────────────────

/** Máximo de unidades de una misma poción en el inventario del laboratorio. */
export const MAX_POTION_STACK = 5
/** Capacidad base del inventario del laboratorio (slots de pociones). */
export const LAB_INVENTORY_BASE = 15
/** Slots extra por ampliación del inventario del laboratorio. */
export const LAB_INVENTORY_PER_UPGRADE = 5
/** Número máximo de ampliaciones del inventario del laboratorio. */
export const LAB_INVENTORY_MAX_UPGRADES = 5
/** Costes para ampliar el inventario del laboratorio. Array indexado por upgrade (0 = primera). */
export const LAB_INVENTORY_UPGRADE_COSTS = [
  { gold: 200,  mana: 100 },
  { gold: 500,  mana: 250 },
  { gold: 1000, mana: 500 },
  { gold: 2000, mana: 1000 },
  { gold: 4000, mana: 2000 },
]
/** Duración del crafteo de una poción en milisegundos. */
export const POTION_CRAFT_DURATION_MS = 30 * 60 * 1000

// ── Entrenamiento ─────────────────────────────────────────────────────────────

/** Stats válidas para salas de entrenamiento. */
export const TRAINING_ROOM_STATS = ['strength', 'agility', 'attack', 'defense', 'max_hp', 'intelligence']

// ── Clases ───────────────────────────────────────────────────────────────────

export const CLASS_COLORS = {
  caudillo:  '#dc2626',
  arcanista: '#7c3aed',
  sombra:    '#0369a1',
  domador:   '#16a34a',
}

export const CLASS_LABELS = {
  caudillo:  'Caudillo',
  arcanista: 'Arcanista',
  sombra:    'Sombra',
  domador:   'Domador',
}

// ── Caza de Botín ────────────────────────────────────────────────────────────

/**
 * Rutas de caza: el jugador elige un slot y, si tiene suerte, obtiene una pieza
 * de ese slot con rareza escalada al nivel del héroe. Las rutas rotan a diario
 * (pool de 3) y pueden regenerarse pagando oro.
 */
export const BOUNTY_ROUTES_CATALOG = [
  { key: 'cuevas_yunque',     slot: 'main_hand', label: 'Cuevas del Yunque',    icon: '⚔️' },
  { key: 'bastion_roto',      slot: 'off_hand',  label: 'Bastión Roto',         icon: '🛡️' },
  { key: 'cumbre_halcon',     slot: 'helmet',    label: 'Cumbre del Halcón',    icon: '🪖' },
  { key: 'santuario_olvidado',slot: 'chest',     label: 'Santuario Olvidado',   icon: '🎽' },
  { key: 'taller_abandonado', slot: 'arms',      label: 'Taller Abandonado',    icon: '🧤' },
  { key: 'senda_cazador',     slot: 'legs',      label: 'Senda del Cazador',    icon: '👖' },
  { key: 'ruinas_peregrino',  slot: 'feet',      label: 'Ruinas del Peregrino', icon: '🥾' },
  { key: 'mercado_fantasma',  slot: 'accessory', label: 'Mercado Fantasma',     icon: '💍' },
]

/** Número de rutas visibles en el pool diario */
export const BOUNTY_POOL_SIZE = 3

/** Duración en minutos de un intento de caza */
export const BOUNTY_DURATION_MIN = 15

/** Coste en recursos por intento (independiente de la rareza, fijo). Solo oro:
 *  iron/wood ya tienen sink en reparar y tier-upgrade; la caza es sumidero de oro. */
export const BOUNTY_COST = { gold: 3000 }

/** Porcentaje de max_hp consumido por intento */
export const BOUNTY_HP_COST_PCT = 0.20

/** Probabilidad base de éxito de la tirada */
export const BOUNTY_SUCCESS_RATE = 0.40

/** Fragmentos de consuelo al fallar (rango min-max) */
export const BOUNTY_CONSOLATION_FRAGMENTS = { min: 3, max: 5 }

/** Costes escalonados para regenerar el pool de rutas (índice = regens previos) */
export const BOUNTY_REGEN_COSTS = [1500, 4000, 10000]

/** Número máximo de regeneraciones por ventana diaria */
export const BOUNTY_REGEN_MAX = BOUNTY_REGEN_COSTS.length

/** Milisegundos hasta el próximo reset automático del pool */
export const BOUNTY_RESET_MS = 24 * 60 * 60 * 1000

/**
 * Distribución de rareza del ítem obtenido según el nivel del héroe.
 * Garantiza que una pieza nunca sea "basura" para el nivel actual.
 * Cada tramo es un objeto { common, uncommon, rare, epic, legendary }
 * con los pesos relativos (sumarán 100).
 */
export const BOUNTY_RARITY_BY_LEVEL = [
  { maxLevel:  2, weights: { common: 70, uncommon: 30, rare: 0,  epic: 0,  legendary: 0  } },
  { maxLevel:  4, weights: { common: 25, uncommon: 55, rare: 20, epic: 0,  legendary: 0  } },
  { maxLevel:  6, weights: { common: 0,  uncommon: 30, rare: 55, epic: 15, legendary: 0  } },
  { maxLevel:  8, weights: { common: 0,  uncommon: 0,  rare: 45, epic: 45, legendary: 10 } },
  { maxLevel: 99, weights: { common: 0,  uncommon: 0,  rare: 20, epic: 55, legendary: 25 } },
]

/** Helper: devuelve los pesos de rareza para el nivel del héroe */
export function bountyRarityWeightsForLevel(heroLevel) {
  const tier = BOUNTY_RARITY_BY_LEVEL.find(t => heroLevel <= t.maxLevel) ?? BOUNTY_RARITY_BY_LEVEL[BOUNTY_RARITY_BY_LEVEL.length - 1]
  return tier.weights
}

/** Helper: coste de HP absoluto para un intento dado max_hp */
export function bountyHpCost(heroMaxHp) {
  return Math.max(1, Math.round(heroMaxHp * BOUNTY_HP_COST_PCT))
}

/** Helper: coste de la próxima regeneración dados los regens ya usados */
export function bountyRegenCost(regensUsed) {
  if (regensUsed >= BOUNTY_REGEN_MAX) return null
  return BOUNTY_REGEN_COSTS[regensUsed]
}
