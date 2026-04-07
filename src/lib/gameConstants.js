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
  { type: 'laboratory',   level: 1, unlocks: ['forge']   },
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
    case 'forge':
      if (currentLevel === 0) return { wood: 80,  iron: 50  }
      if (currentLevel === 1) return { wood: 100, iron: 70  }
      if (currentLevel === 2) return { wood: 220, iron: 150, mana: 40  }
      if (currentLevel === 3) return { wood: 380, iron: 260, mana: 100 }
      return                          { wood: 580, iron: 400, mana: 190 }
    case 'library':
      if (currentLevel === 0) return { wood: 100, iron: 60,  mana: 30  }
      if (currentLevel === 1) return { wood: 180, iron: 110, mana: 70  }
      if (currentLevel === 2) return { wood: 340, iron: 210, mana: 150 }
      if (currentLevel === 3) return { wood: 560, iron: 360, mana: 270 }
      return                          { wood: 850, iron: 550, mana: 420 }
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
 * Incluye los edificios de base más forge y library, que arrancan bloqueados.
 */
export const ALL_BUILDING_TYPES = [...BASE_BUILDING_TYPES, 'forge', 'library']

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

// ── Runas ─────────────────────────────────────────────────────────────────────

/**
 * Slots de runa disponibles por nivel de Herrería.
 * Forja Nv.1 → 0 slots, Nv.2 → 1 slot, Nv.3+ → 2 slots por ítem equipado.
 */
export function runeSlotsByForgeLevel(forgeLevel) {
  if (forgeLevel >= 3) return 2
  if (forgeLevel >= 2) return 1
  return 0
}

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

// ── Árbol de investigación ────────────────────────────────────────────────────

/**
 * 16 nodos de investigación en 4 ramas: combat, expedition, crafting, magic.
 * Cada nodo tiene un efecto que se aplica a nivel de juego cuando está completado.
 * Fuente de verdad para la API (_research.js) y el frontend (BibliotecaZone).
 */
export const RESEARCH_NODES = [
  // Combat
  { id: 'combat_1',     branch: 'combat',     position: 1, name: 'Técnica de Ataque',     description: '+5% al ataque base.',                                    effect_type: 'attack_pct',          effect_value: 0.05,  cost: { gold: 100,  iron: 60,  mana: 30  }, duration_hours: 4   },
  { id: 'combat_2',     branch: 'combat',     position: 2, name: 'Postura Defensiva',     description: '+5% a la defensa base.',                                 effect_type: 'defense_pct',         effect_value: 0.05,  cost: { gold: 200,  iron: 120, mana: 80  }, duration_hours: 12,  prerequisite: 'combat_1' },
  { id: 'combat_3',     branch: 'combat',     position: 3, name: 'Golpe Crítico',         description: '+3% probabilidad de crítico.',                           effect_type: 'crit_pct',            effect_value: 0.03,  cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'combat_2' },
  { id: 'combat_4',     branch: 'combat',     position: 4, name: 'Maestría en Combate',   description: '+10% al daño en la Torre.',                              effect_type: 'tower_dmg_pct',       effect_value: 0.10,  cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'combat_3' },
  // Expedition
  { id: 'expedition_1', branch: 'expedition', position: 1, name: 'Saqueo Eficiente',      description: '+5% al oro de expediciones.',                            effect_type: 'expedition_gold_pct', effect_value: 0.05,  cost: { gold: 100,  iron: 60,  mana: 30  }, duration_hours: 4   },
  { id: 'expedition_2', branch: 'expedition', position: 2, name: 'Mantenimiento',         description: '-10% al desgaste de equipo en expediciones.',            effect_type: 'durability_loss_pct', effect_value: -0.10, cost: { gold: 200,  iron: 120, mana: 80  }, duration_hours: 12,  prerequisite: 'expedition_1' },
  { id: 'expedition_3', branch: 'expedition', position: 3, name: 'Aprendizaje Acelerado', description: '+5% a la XP de expediciones.',                           effect_type: 'expedition_xp_pct',   effect_value: 0.05,  cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'expedition_2' },
  { id: 'expedition_4', branch: 'expedition', position: 4, name: 'Doble Expedición',      description: 'Permite enviar un héroe a dos expediciones simultáneas.', effect_type: 'expedition_slots',    effect_value: 1,     cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'expedition_3' },
  // Crafting
  { id: 'crafting_1',   branch: 'crafting',   position: 1, name: 'Técnicas de Reparación',description: '-10% al coste de reparación.',                          effect_type: 'repair_cost_pct',     effect_value: -0.10, cost: { gold: 100,  iron: 60,  mana: 30  }, duration_hours: 4   },
  { id: 'crafting_2',   branch: 'crafting',   position: 2, name: 'Ojo de Buitre',         description: '+5% a la tasa de drop de ítems.',                       effect_type: 'item_drop_pct',       effect_value: 0.05,  cost: { gold: 200,  iron: 120, mana: 80  }, duration_hours: 12,  prerequisite: 'crafting_1' },
  { id: 'crafting_3',   branch: 'crafting',   position: 3, name: 'Grabado Profundo',      description: 'Desbloquea un 3er slot de runa en todos los ítems.',     effect_type: 'rune_slot_bonus',     effect_value: 1,     cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'crafting_2' },
  { id: 'crafting_4',   branch: 'crafting',   position: 4, name: 'Artesano Supremo',      description: 'Reduce en 1 el nivel de Lab necesario para craftear runas.',effect_type: 'lab_req_reduction', effect_value: 1,     cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'crafting_3' },
  // Magic
  { id: 'magic_1',      branch: 'magic',      position: 1, name: 'Estudios Arcanos',      description: '+5% a la inteligencia base.',                            effect_type: 'intelligence_pct',    effect_value: 0.05,  cost: { gold: 100,  iron: 60,  mana: 30  }, duration_hours: 4   },
  { id: 'magic_2',      branch: 'magic',      position: 2, name: 'Canalización Arcana',   description: '+5% a la producción de maná.',                           effect_type: 'mana_rate_pct',       effect_value: 0.05,  cost: { gold: 200,  iron: 120, mana: 80  }, duration_hours: 12,  prerequisite: 'magic_1' },
  { id: 'magic_3',      branch: 'magic',      position: 3, name: 'Fusión Rúnica',         description: '-10% al coste de fusión de cartas.',                     effect_type: 'fusion_cost_pct',     effect_value: -0.10, cost: { gold: 500,  iron: 300, mana: 200 }, duration_hours: 48,  prerequisite: 'magic_2' },
  { id: 'magic_4',      branch: 'magic',      position: 4, name: 'Resonancia Rúnica',     description: '+10% a los bonos de runas.',                             effect_type: 'enchantment_amp',     effect_value: 0.10,  cost: { gold: 1200, iron: 700, mana: 500 }, duration_hours: 120, prerequisite: 'magic_3' },
]

/** Costes de mejora de tier en la Forja v2. key = tier actual → siguiente */
export const ITEM_TIER_UPGRADE_COST = {
  1: { gold: 150, iron: 80, mana: 30 },
  2: { gold: 350, iron: 200, mana: 80 },
}
