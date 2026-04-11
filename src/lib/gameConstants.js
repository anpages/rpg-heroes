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
      return { wood: Math.round(75 * Math.pow(currentLevel, 1.5)), iron: Math.round(35 * Math.pow(currentLevel, 1.4)) }
    case 'lumber_mill':
      return { wood: Math.round(50 * Math.pow(currentLevel, 1.5)), iron: Math.round(25 * Math.pow(currentLevel, 1.4)) }
    case 'gold_mine':
      if (currentLevel === 0) return { wood: 60, iron: 25 }
      return { wood: Math.round(45 * Math.pow(currentLevel, 1.5)), iron: Math.round(22 * Math.pow(currentLevel, 1.4)) }
    case 'mana_well':
      if (currentLevel === 0) return { wood: 60, iron: 30 }
      return { wood: Math.round(55 * Math.pow(currentLevel, 1.5)), iron: Math.round(25 * Math.pow(currentLevel, 1.4)), mana: Math.round(20 * Math.pow(currentLevel, 1.3)) }
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
  common:    { gold: 8,  mana: 0  },
  uncommon:  { gold: 16, mana: 1  },
  rare:      { gold: 28, mana: 3  },
  epic:      { gold: 45, mana: 6  },
  legendary: { gold: 70, mana: 10 },
}

/**
 * Iron consumido por punto de durabilidad reparado, según rareza.
 * Común no pide iron — el early game sigue con gold puro. A partir de
 * uncommon cada reparación consume iron, que escala fuerte con rareza.
 * Diseñado para dar sumidero recurrente a la producción de la mina.
 */
export const REPAIR_IRON_BY_RARITY = {
  common:    0,
  uncommon:  2,
  rare:      4,
  epic:      8,
  legendary: 12,
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

/**
 * Transmutación alternativa al desmantelar: en vez de vender por oro, el
 * jugador paga oro al laboratorio y obtiene materiales de crafteo
 * (fragmentos/esencia/maná). Los retornos están deliberadamente por debajo
 * del farmeo directo para que sea un atajo de conveniencia, no un exploit.
 */
export const DISMANTLE_TRANSMUTE_TABLE = {
  common:    { cost: 50,   fragments: 2,  essence: 0,  mana: 0  },
  uncommon:  { cost: 120,  fragments: 4,  essence: 1,  mana: 0  },
  rare:      { cost: 300,  fragments: 8,  essence: 2,  mana: 10 },
  epic:      { cost: 700,  fragments: 15, essence: 5,  mana: 30 },
  legendary: { cost: 1500, fragments: 30, essence: 10, mana: 80 },
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
 *  Requiere oro + fragmentos (drops físicos) + esencia (drops mágicos).
 *  Además pide iron/wood para dar uso al excedente de la mina/aserradero
 *  — mejorar equipo es el sumidero puntual más grande del juego. */
export const ITEM_TIER_UPGRADE_COST = {
  1: { gold: 800,  fragments: 3, essence: 1, iron: 150, wood: 100 },
  2: { gold: 2500, fragments: 8, essence: 3, iron: 500, wood: 350 },
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
  chamber:    { mercader: 1, erudito: 2, cazador: 2 },
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

// ── Cámaras: incursiones rápidas ─────────────────────────────────────────────

/**
 * Tipos de cámara. Cada tipo es:
 *   - una duración (minutos sorteados entre min/max)
 *   - un coste de HP escalado (más larga = más caro)
 *   - un PERFIL de loot exclusivo (solo arma / solo armadura / cualquiera)
 *
 * Mecánica: cada cámara genera 3 rolls del MISMO arquetipo (su cofre exclusivo).
 * El jugador elige el mejor de los 3 al recoger. La elección de cámara
 * decide QUÉ tipo de equipo puede dropear, no si dropea más o menos.
 */
export const CHAMBER_TYPES = {
  mercader: {
    label:      'Cámara del Mercader',
    icon:       '🪙',
    color:      '#d97706',
    minMinutes: 3,
    maxMinutes: 5,
    hpCostPct:  0.12,
  },
  erudito: {
    label:      'Cámara del Erudito',
    icon:       '📜',
    color:      '#0369a1',
    minMinutes: 5,
    maxMinutes: 8,
    hpCostPct:  0.22,
  },
  cazador: {
    label:      'Cámara del Cazador',
    icon:       '⚔️',
    color:      '#7c3aed',
    minMinutes: 5,
    maxMinutes: 8,
    hpCostPct:  0.22,
  },
}

/** Número fijo de cofres ofrecidos al recoger. El jugador elige uno. */
export const CHAMBER_CHEST_COUNT = 3

/**
 * TTL del token firmado de elección de cofre (15 min).
 * Si el jugador deja la app abierta y no decide, el token caduca y debe
 * volver a llamar a chamber-collect (que regenera 3 cofres nuevos).
 */
export const CHAMBER_CHOICE_TOKEN_TTL_MS = 15 * 60 * 1000

/**
 * Slots posibles por cámara. Define qué tipo de equipo puede dropear.
 * - mercader: cualquier slot (incluye accesorios — único cofre que los da)
 * - erudito:  solo armadura (sin accesorios)
 * - cazador:  solo armas
 */
export const CHAMBER_ITEM_SLOTS = {
  mercader: ['main_hand', 'off_hand', 'helmet', 'chest', 'arms', 'legs', 'accessory'],
  erudito:  ['helmet', 'chest', 'arms', 'legs'],
  cazador:  ['main_hand', 'off_hand'],
}

/** Etiqueta corta del tipo de equipo de cada cámara, para la UI. */
export const CHAMBER_ITEM_KIND = {
  mercader: 'Cualquier equipo',
  erudito:  'Solo armadura',
  cazador:  'Solo armas',
}

/**
 * Perfil de cofre por arquetipo. Cada cámara solo genera cofres de SU
 * arquetipo (3 rolls del mismo perfil). Las cantidades concretas de oro/xp
 * se calculan multiplicando los multiplicadores por chamberBaseReward(difficulty).
 *
 * Diferenciación:
 *   mercader (3-5 min, 12% HP)  → básico, todo poco, pool de slot amplio
 *   erudito  (5-8 min, 22% HP)  → armadura (helmet/chest/arms/legs)
 *   cazador  (5-8 min, 22% HP)  → armas (main_hand/off_hand)
 *
 * Erudito y cazador comparten tiempo, coste HP, probabilidades y mults —
 * la única diferencia entre ellos es qué tipo de equipo puede dropear
 * (decidido en CHAMBER_ITEM_SLOTS).
 *
 * Los items siguen siendo tier 1-2 (nunca tier 3 — eso queda para expediciones).
 * Las cartas NUNCA salen de cámaras (cardChance siempre 0).
 */
export const CHAMBER_CHEST_REWARDS = {
  mercader: {
    label:          'Cofre del Mercader',
    icon:           '🪙',
    color:          '#d97706',
    description:    'La cámara del oro — y la única con accesorios',
    goldMult:       1.4,
    xpMult:         0.8,
    itemChance:     0.14,  // por debajo de erudito/cazador, compensa con pool amplio + accesorios
    fragmentChance: 0.20,  // gateado por dificultad ≥ 2
    fragmentMin:    1,
    fragmentMax:    2,
  },
  erudito: {
    label:          'Cofre del Erudito',
    icon:           '📜',
    color:          '#0369a1',
    description:    'Armadura para el héroe estudioso',
    goldMult:       1.1,
    xpMult:         0.9,
    itemChance:     0.22,  // armadura (helmet/chest/arms/legs)
    fragmentChance: 0.26,
    fragmentMin:    1,
    fragmentMax:    2,
  },
  cazador: {
    label:          'Cofre del Cazador',
    icon:           '⚔️',
    color:          '#7c3aed',
    description:    'Armas para el cazador veterano',
    goldMult:       1.1,
    xpMult:         0.9,
    itemChance:     0.22,  // armas (main_hand/off_hand)
    fragmentChance: 0.26,
    fragmentMin:    1,
    fragmentMax:    2,
  },
}

/**
 * Dificultad mínima para que las cámaras dropeen fragmentos.
 * Alineado con cuándo aparecen en mazmorras: Ruinas (nv5) en adelante.
 * Con chamberDifficultyForLevel, dif=2 → héroe nivel ≥ 4.
 */
export const CHAMBER_FRAGMENT_MIN_DIFFICULTY = 2

/**
 * Recompensas base por dificultad de cámara — escala con el nivel del héroe.
 * difficulty 1 → héroe nivel 1-3, difficulty 5 → héroe nivel ~15, etc.
 * Estos son los valores ANTES de aplicar el multiplicador del cofre.
 */
export function chamberBaseReward(difficulty) {
  const d = Math.max(1, Math.min(10, difficulty))
  return {
    gold: Math.round(20 + d * 18),       // d1=38, d5=110, d10=200
    xp:   Math.round(10 + d * 9),        // d1=19, d5=55,  d10=100
  }
}

/** Dificultad recomendada para una cámara según el nivel del héroe (1-10) */
export function chamberDifficultyForLevel(heroLevel) {
  return Math.max(1, Math.min(10, Math.ceil(heroLevel / 3)))
}

/**
 * Coste de HP en puntos absolutos para una cámara dado el max_hp del héroe.
 * Devuelve mínimo 1.
 */
export function chamberHpCost(chamberType, heroMaxHp) {
  const cfg = CHAMBER_TYPES[chamberType]
  if (!cfg) return 1
  return Math.max(1, Math.round(heroMaxHp * cfg.hpCostPct))
}

// ── Pociones ─────────────────────────────────────────────────────────────────

/** Máximo de unidades de una misma poción en el inventario del laboratorio. */
export const MAX_POTION_STACK = 5
/** Capacidad base del inventario del laboratorio (slots totales entre pociones y runas). */
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
/** Duración del crafteo de una runa en milisegundos. */
export const RUNE_CRAFT_DURATION_MS   = 60 * 60 * 1000  // 1 hora

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
