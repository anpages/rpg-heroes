import {
  Coins, Axe, Sparkles, Zap, BookOpen, FlaskConical,
  Pickaxe, Dumbbell, Sword, Map, Hammer, Sprout,
  Swords, ShieldCheck, Brain, Flame, Heart,
  Droplets, Leaf,
} from 'lucide-react'
import {
  UNLOCK_TRIGGERS,
  TRAINING_ROOM_HERO_LEVEL_REQUIRED,
  buildingRate,
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
    effect: (level) => `${buildingRate('gold_mine', level).rate} hierro/h`,
    nextEffect: (level) => `${buildingRate('gold_mine', level + 1).rate} hierro/h`,
  },
  lumber_mill: {
    name: 'Aserradero',
    description: 'Procesa la madera del bosque cercano.',
    icon: Axe,
    color: '#16a34a',
    effect: (level) => `${buildingRate('lumber_mill', level).rate} madera/h`,
    nextEffect: (level) => `${buildingRate('lumber_mill', level + 1).rate} madera/h`,
  },
  mana_well: {
    name: 'Pozo de Maná',
    description: 'Canaliza energía arcana desde las líneas ley.',
    icon: Sparkles,
    color: '#7c3aed',
    effect: (level) => `${buildingRate('mana_well', level).rate} maná/h`,
    nextEffect: (level) => `${buildingRate('mana_well', level + 1).rate} maná/h`,
  },
  herb_garden: {
    name: 'Jardín de Hierbas',
    description: 'Cultiva hierbas medicinales y flores exóticas.',
    icon: Sprout,
    color: '#15803d',
    effect: (level) => `${buildingRate('herb_garden', level).rate} hierbas/h`,
    nextEffect: (level) => `${buildingRate('herb_garden', level + 1).rate} hierbas/h`,
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
    name: 'Laboratorio',
    description: 'Combina materiales procesados en pociones, kits y piedras de forja.',
    icon: FlaskConical,
    color: '#7c3aed',
    effect: (level) => level === 0 ? 'Sin construir' : 'Pociones, kits y piedras de forja',
    nextEffect: (level) => level === 0 ? 'Desbloquea crafteo de productos' : 'Nivel máximo',
  },
  carpinteria: {
    name: 'Carpintería',
    description: 'Transforma madera en tablones y madera compuesta.',
    icon: Hammer,
    color: '#65a30d',
    effect: (level) => level === 0 ? 'Sin construir' : 'Tablones → Madera Compuesta',
    nextEffect: (level) => level === 0 ? 'Desbloquea Tablones y Madera Compuesta' : 'Nivel máximo',
  },
  fundicion: {
    name: 'Fundición',
    description: 'Funde hierro en lingotes y acero templado.',
    icon: Flame,
    color: '#b45309',
    effect: (level) => level === 0 ? 'Sin construir' : 'Lingotes → Acero Templado',
    nextEffect: (level) => level === 0 ? 'Desbloquea Lingotes y Acero Templado' : 'Nivel máximo',
  },
  destileria_arcana: {
    name: 'Destilería Arcana',
    description: 'Cristaliza maná en cristales y maná concentrado.',
    icon: Droplets,
    color: '#6d28d9',
    effect: (level) => level === 0 ? 'Sin construir' : 'Cristales → Maná Concentrado',
    nextEffect: (level) => level === 0 ? 'Desbloquea Cristales y Maná Concentrado' : 'Nivel máximo',
  },
  herbolario: {
    name: 'Herbolario',
    description: 'Procesa hierbas en extractos y base de poción.',
    icon: Leaf,
    color: '#059669',
    effect: (level) => level === 0 ? 'Sin construir' : 'Extractos → Base de Poción',
    nextEffect: (level) => level === 0 ? 'Desbloquea Extractos y Base de Poción' : 'Nivel máximo',
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

export const PRODUCTION_TYPES = ['lumber_mill', 'gold_mine', 'herb_garden', 'mana_well']

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
].map(r => ({ ...r, heroLevelMin: TRAINING_ROOM_HERO_LEVEL_REQUIRED[r.stat] }))

export const STAT_LABEL_MAP = {
  strength: 'FUE', agility: 'AGI', attack: 'ATQ', defense: 'DEF', max_hp: 'HP', intelligence: 'INT',
}

/* ─── Laboratorio ────────────────────────────────────────────────────────────── */

export const EFFECT_COLOR = {
  hp_restore:        '#dc2626',
  atk_boost:         '#0369a1',
  def_boost:         '#16a34a',
  xp_boost:          '#d97706',
  time_reduction:    '#0891b2',
  loot_boost:        '#7c3aed',
  gold_boost:        '#d97706',
  hp_cost_reduction: '#059669',
  tower_shield:      '#64748b',
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
    case 'gold_boost':        return `+${pct}% oro`
    case 'hp_cost_reduction': return `−${pct}% coste HP`
    case 'tower_shield':      return `−${pct}% durabilidad`
    default:                  return ''
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
  { id: 'produccion', label: 'Producción',  icon: Coins       },
  { id: 'taller',     label: 'Laboratorio', icon: FlaskConical },
  { id: 'biblioteca', label: 'Biblioteca',  icon: BookOpen    },
]

/* ─── Recursos ───────────────────────────────────────────────────────────────── */

export const RESOURCE_ITEMS = [
  { key: 'wood',  icon: Axe,      color: '#16a34a', label: 'Madera' },
  { key: 'iron',  icon: Pickaxe,  color: '#64748b', label: 'Hierro' },
  { key: 'mana',  icon: Sparkles, color: '#7c3aed', label: 'Maná'   },
  { key: 'herbs', icon: Sprout,   color: '#15803d', label: 'Hierbas' },
]


/* ─── Header resources grid ──────────────────────────────────────────────────── */

export const HEADER_RESOURCES = [
  { key: 'wood',      Icon: Axe,      color: '#16a34a', label: 'Madera',      short: 'Mad'  },
  { key: 'iron',      Icon: Pickaxe,  color: '#64748b', label: 'Hierro',      short: 'Hier' },
  { key: 'mana',      Icon: Sparkles, color: '#7c3aed', label: 'Maná',        short: 'Maná' },
  { key: 'herbs',     Icon: Sprout,   color: '#15803d', label: 'Hierbas',     short: 'Herb' },
  { key: 'fragments', Icon: Sparkles, color: '#f59e0b', label: 'Fragmentos',  short: 'Frag' },
  { key: 'essence',   Icon: Droplets, color: '#8b5cf6', label: 'Esencia',     short: 'Esen' },
]

export const RESOURCE_LABEL = {
  iron: 'Hierro', wood: 'Madera', mana: 'Maná', herbs: 'Hierbas',
  coal: 'Carbón', fiber: 'Fibra', arcane_dust: 'Polvo Arcano', flowers: 'Flores',
  fragments: 'Fragmentos', essence: 'Esencia', gold: 'Oro',
}
