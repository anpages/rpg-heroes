import {
  Coins, Axe, Sparkles, Zap, BookOpen, FlaskConical,
  Pickaxe, Dumbbell, Sword, Map, Hammer, Sprout,
  Swords, ShieldCheck, Brain, Layers, Flame, Heart,
  Gem, TreePine, Wind, Flower2, Droplets, Leaf,
} from 'lucide-react'
import {
  UNLOCK_TRIGGERS,
  TRAINING_ROOM_BASE_LEVEL_REQUIRED,
  buildingRateAndCap,
} from '../../lib/gameConstants.js'

/* ─── Animaciones ─────────────────────────────────────────────────────────────── */

export const cardVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
}

/* ─── Metadatos de edificios ─────────────────────────────────────────────────── */

export const BUILDING_META = {
  gold_mine: {
    name: 'Mina de Hierro',
    description: 'Extrae hierro de las profundidades de la tierra.',
    icon: Pickaxe,
    color: '#64748b',
    effect: (level) => {
      const { rate, secondary } = buildingRateAndCap('gold_mine', level)
      return secondary ? `${rate} hierro/h + ${secondary.rate} carbón/h` : `${rate} hierro/h`
    },
    nextEffect: (level) => {
      const { rate, secondary } = buildingRateAndCap('gold_mine', level + 1)
      return secondary ? `${rate} hierro/h + ${secondary.rate} carbón/h` : `${rate} hierro/h`
    },
  },
  lumber_mill: {
    name: 'Aserradero',
    description: 'Procesa la madera del bosque cercano.',
    icon: Axe,
    color: '#16a34a',
    effect: (level) => {
      const { rate, secondary } = buildingRateAndCap('lumber_mill', level)
      return secondary ? `${rate} madera/h + ${secondary.rate} fibra/h` : `${rate} madera/h`
    },
    nextEffect: (level) => {
      const { rate, secondary } = buildingRateAndCap('lumber_mill', level + 1)
      return secondary ? `${rate} madera/h + ${secondary.rate} fibra/h` : `${rate} madera/h`
    },
  },
  mana_well: {
    name: 'Pozo de Maná',
    description: 'Canaliza energía arcana desde las líneas ley.',
    icon: Sparkles,
    color: '#7c3aed',
    effect: (level) => {
      const { rate, secondary } = buildingRateAndCap('mana_well', level)
      return secondary ? `${rate} maná/h + ${secondary.rate} polvo/h` : `${rate} maná/h`
    },
    nextEffect: (level) => {
      const { rate, secondary } = buildingRateAndCap('mana_well', level + 1)
      return secondary ? `${rate} maná/h + ${secondary.rate} polvo/h` : `${rate} maná/h`
    },
  },
  herb_garden: {
    name: 'Jardín de Hierbas',
    description: 'Cultiva hierbas medicinales y flores exóticas.',
    icon: Sprout,
    color: '#15803d',
    effect: (level) => {
      const { rate, secondary } = buildingRateAndCap('herb_garden', level)
      return secondary ? `${rate} hierbas/h + ${secondary.rate} flores/h` : `${rate} hierbas/h`
    },
    nextEffect: (level) => {
      const { rate, secondary } = buildingRateAndCap('herb_garden', level + 1)
      return secondary ? `${rate} hierbas/h + ${secondary.rate} flores/h` : `${rate} hierbas/h`
    },
  },
  library: {
    name: 'Biblioteca',
    description: 'Alberga el árbol de investigación.',
    icon: BookOpen,
    color: '#0f766e',
    effect: (level) => {
      if (level === 0) return 'Sin construir'
      if (level === 1) return 'Investigaciones básicas (pos. 1)'
      if (level === 2) return 'Investigaciones intermedias (pos. 2)'
      if (level === 3) return 'Investigaciones avanzadas (pos. 3)'
      if (level === 4) return 'Investigaciones avanzadas (pos. 3)'
      return 'Investigaciones maestras (pos. 4)'
    },
    nextEffect: (level) => {
      if (level === 0) return 'Investigaciones básicas (pos. 1)'
      if (level === 1) return 'Desbloquea investigaciones pos. 2'
      if (level === 2) return 'Desbloquea investigaciones pos. 3'
      if (level === 3) return 'Camino hacia investigaciones maestras'
      return 'Desbloquea investigaciones maestras (pos. 4)'
    },
  },
  laboratory: {
    name: 'Taller',
    description: 'Combina materiales procesados en kits, piedras, pergaminos y pociones.',
    icon: FlaskConical,
    color: '#7c3aed',
    effect: (level) => {
      if (level === 0) return 'Sin construir'
      if (level === 1) return 'Recetas básicas'
      if (level === 2) return 'Recetas intermedias'
      if (level === 3) return 'Recetas avanzadas'
      if (level === 4) return 'Recetas superiores'
      return 'Todas las recetas'
    },
    nextEffect: (level) => {
      if (level === 0) return 'Recetas básicas'
      if (level === 1) return 'Recetas intermedias'
      if (level === 2) return 'Recetas avanzadas'
      if (level === 3) return 'Recetas superiores'
      return 'Recetas maestras'
    },
  },
  carpinteria: {
    name: 'Carpintería',
    description: 'Transforma madera en tablones y materiales compuestos.',
    icon: Hammer,
    color: '#65a30d',
    effect: (level) => {
      if (level === 0) return 'Sin construir'
      if (level < 3) return 'Tablones'
      return 'Tablones + Madera Compuesta'
    },
    nextEffect: (level) => {
      if (level === 0) return 'Tablones'
      if (level === 2) return 'Desbloquea Madera Compuesta'
      if (level === 3) return 'Segundo slot a Nv.4'
      return 'Velocidad máxima'
    },
  },
  fundicion: {
    name: 'Fundición',
    description: 'Funde mineral de hierro en lingotes y aleaciones de acero.',
    icon: Flame,
    color: '#b45309',
    effect: (level) => {
      if (level === 0) return 'Sin construir'
      if (level < 3) return 'Lingotes de Acero'
      return 'Lingotes + Acero Templado'
    },
    nextEffect: (level) => {
      if (level === 0) return 'Lingotes de Acero'
      if (level === 2) return 'Desbloquea Acero Templado'
      if (level === 3) return 'Segundo slot a Nv.4'
      return 'Velocidad máxima'
    },
  },
  destileria_arcana: {
    name: 'Destilería Arcana',
    description: 'Cristaliza maná bruto en gemas y concentrados arcanos.',
    icon: Droplets,
    color: '#6d28d9',
    effect: (level) => {
      if (level === 0) return 'Sin construir'
      if (level < 3) return 'Cristales de Maná'
      return 'Cristales + Maná Concentrado'
    },
    nextEffect: (level) => {
      if (level === 0) return 'Cristales de Maná'
      if (level === 2) return 'Desbloquea Maná Concentrado'
      if (level === 3) return 'Segundo slot a Nv.4'
      return 'Velocidad máxima'
    },
  },
  herbolario: {
    name: 'Herbolario',
    description: 'Procesa hierbas en extractos y bases alquímicas.',
    icon: Leaf,
    color: '#059669',
    effect: (level) => {
      if (level === 0) return 'Sin construir'
      if (level < 3) return 'Extractos Herbales'
      return 'Extractos + Base de Poción'
    },
    nextEffect: (level) => {
      if (level === 0) return 'Extractos Herbales'
      if (level === 2) return 'Desbloquea Base de Poción'
      if (level === 3) return 'Segundo slot a Nv.4'
      return 'Velocidad máxima'
    },
  },
}

/* ─── Nivel de Base ──────────────────────────────────────────────────────────── */

export const BASE_TIERS = [
  { minLevel: 1,  color: '#64748b', name: 'Asentamiento',          subtitle: 'Una chispa en la oscuridad.' },
  { minLevel: 2,  color: '#b45309', name: 'Campamento',            subtitle: 'Las primeras murallas se alzan.' },
  { minLevel: 3,  color: '#0369a1', name: 'Fortaleza Incipiente',  subtitle: 'Tu nombre empieza a resonar.' },
  { minLevel: 4,  color: '#1d4ed8', name: 'Bastión',               subtitle: 'Los rivales te toman en serio.' },
  { minLevel: 5,  color: '#6d28d9', name: 'Ciudadela',             subtitle: 'Una potencia que no se puede ignorar.' },
  { minLevel: 7,  color: '#be185d', name: 'Fortaleza Épica',       subtitle: 'Tu leyenda precede a tus héroes.' },
  { minLevel: 10, color: '#7f1d1d', name: 'Ciudadela Legendaria',  subtitle: 'Solo los dioses saben tu nombre.' },
]

/* ─── Edificios de producción ────────────────────────────────────────────────── */

export const PRODUCTION_TYPES = ['gold_mine', 'lumber_mill', 'mana_well', 'herb_garden']

/* ─── Requisitos de desbloqueo ───────────────────────────────────────────────── */

// Derivado automáticamente de UNLOCK_TRIGGERS (gameConstants.js) + BUILDING_META
export const UNLOCK_REQUIREMENTS = Object.fromEntries(
  UNLOCK_TRIGGERS.flatMap(t =>
    t.unlocks.map(u => [u, { name: BUILDING_META[t.type]?.name ?? t.type, level: t.level }])
  )
)

/* ─── Salas de entrenamiento ─────────────────────────────────────────────────── */

export const TRAINING_ROOMS = [
  { stat: 'strength',     label: 'Fuerza',         icon: Dumbbell,    color: '#dc2626' },
  { stat: 'agility',      label: 'Agilidad',        icon: Zap,         color: '#d97706' },
  { stat: 'attack',       label: 'Ataque',          icon: Swords,      color: '#0369a1' },
  { stat: 'defense',      label: 'Defensa',         icon: ShieldCheck, color: '#16a34a' },
  { stat: 'max_hp',       label: 'Resistencia',     icon: Heart,       color: '#e11d48' },
  { stat: 'intelligence', label: 'Inteligencia',    icon: Brain,       color: '#7c3aed' },
].map(r => ({ ...r, baseLevelMin: TRAINING_ROOM_BASE_LEVEL_REQUIRED[r.stat] }))

export const STAT_LABEL_MAP = {
  strength: 'FUE', agility: 'AGI', attack: 'ATQ', defense: 'DEF', max_hp: 'HP', intelligence: 'INT',
}

/* ─── Laboratorio ────────────────────────────────────────────────────────────── */

export const EFFECT_COLOR = {
  hp_restore:      '#dc2626',
  atk_boost:       '#0369a1',
  def_boost:       '#16a34a',
  xp_boost:        '#d97706',
  time_reduction:  '#0891b2',
  loot_boost:      '#7c3aed',
  gold_boost:      '#d97706',
  card_guaranteed: '#2563eb',
  free_repair:     '#64748b',
}

// Descripción corta del beneficio de una poción — se usa en el inventario del
// laboratorio y en los paneles de pociones antes de cada actividad para que el
// jugador no tenga que volver al lab para recordar qué hace cada receta.
export function describePotionEffect(effectType, effectValue) {
  const pct = Math.round((effectValue ?? 0) * 100)
  switch (effectType) {
    case 'hp_restore':      return `+${pct}% HP`
    case 'atk_boost':       return `+${pct}% ATQ`
    case 'def_boost':       return `+${pct}% DEF`
    case 'xp_boost':        return `+${pct}% XP`
    case 'time_reduction':  return `−${pct}% tiempo`
    case 'loot_boost':      return `+${pct}% botín`
    case 'gold_boost':      return `+${pct}% oro`
    case 'card_guaranteed': return 'Táctica garantizada'
    case 'free_repair':     return 'Reparación gratis'
    default:                return ''
  }
}


/* ─── Investigación ──────────────────────────────────────────────────────────── */

export const BRANCH_META = {
  combat:     { label: 'Combate',     icon: Sword,    color: '#dc2626' },
  expedition: { label: 'Expedición',  icon: Map,      color: '#0369a1' },
  crafting:   { label: 'Artesanía',   icon: Hammer,   color: '#b45309' },
  magic:      { label: 'Magia',       icon: Sparkles, color: '#7c3aed' },
}

export const BRANCH_ORDER = ['combat', 'expedition', 'crafting', 'magic']

/* ─── Navegación ─────────────────────────────────────────────────────────────── */

export const ZONES = [
  { id: 'produccion',    label: 'Producción',    icon: Coins       },
  { id: 'refinado',      label: 'Refinado',      icon: Hammer      },
  { id: 'taller',        label: 'Taller',        icon: FlaskConical },
  { id: 'entrenamiento', label: 'Entrenamiento', icon: Dumbbell    },
  { id: 'biblioteca',    label: 'Biblioteca',    icon: BookOpen    },
]

/* ─── Recursos ───────────────────────────────────────────────────────────────── */

export const RESOURCE_ITEMS = [
  { key: 'wood',  icon: Axe,      color: '#16a34a', label: 'Madera' },
  { key: 'iron',  icon: Pickaxe,  color: '#64748b', label: 'Hierro' },
  { key: 'mana',  icon: Sparkles, color: '#7c3aed', label: 'Maná'   },
  { key: 'herbs', icon: Sprout,   color: '#15803d', label: 'Hierbas' },
]

export const SECONDARY_RESOURCE_ITEMS = [
  { key: 'coal',        icon: Gem,     color: '#374151', label: 'Carbón' },
  { key: 'fiber',       icon: TreePine, color: '#65a30d', label: 'Fibra' },
  { key: 'arcane_dust', icon: Wind,    color: '#8b5cf6', label: 'Polvo Arcano' },
  { key: 'flowers',     icon: Flower2, color: '#ec4899', label: 'Flores' },
]

/* ─── Header resources grid ──────────────────────────────────────────────────── */

export const HEADER_RESOURCES = [
  { key: 'wood',  Icon: Axe,      color: '#16a34a', label: 'Madera',  short: 'Mad'  },
  { key: 'iron',  Icon: Pickaxe,  color: '#64748b', label: 'Hierro',  short: 'Hier' },
  { key: 'mana',  Icon: Sparkles, color: '#7c3aed', label: 'Maná',    short: 'Maná' },
  { key: 'herbs', Icon: Sprout,   color: '#15803d', label: 'Hierbas', short: 'Herb' },
]

export const RESOURCE_LABEL = {
  iron: 'Hierro', wood: 'Madera', mana: 'Maná', herbs: 'Hierbas',
  coal: 'Carbón', fiber: 'Fibra', arcane_dust: 'Polvo Arcano', flowers: 'Flores',
  fragments: 'Fragmentos', essence: 'Esencia', gold: 'Oro',
}
