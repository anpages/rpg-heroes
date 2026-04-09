import {
  Coins, Axe, Sparkles, Zap, BookOpen, FlaskConical,
  Pickaxe, Dumbbell, Home, Sword, Map, Hammer,
  Swords, ShieldCheck, Brain, Layers, Flame,
} from 'lucide-react'
import {
  UNLOCK_TRIGGERS,
  TRAINING_ROOM_BASE_LEVEL_REQUIRED,
  ironRateForLevel,
  woodRateForLevel,
  manaRateForLevel,
} from '../../lib/gameConstants.js'

/* ─── Animaciones ─────────────────────────────────────────────────────────────── */

export const cardVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
}

/* ─── Metadatos de edificios ─────────────────────────────────────────────────── */

export const BUILDING_META = {
  energy_nexus: {
    name: 'Nexo Arcano',
    description: 'Canaliza la energía del mundo para alimentar las estructuras de la base.',
    icon: Zap,
    color: '#0891b2',
    effect: (level) => `${level * 30} energía`,
    nextEffect: (level) => `${(level + 1) * 30} energía`,
  },
  gold_mine: {
    name: 'Mina de Hierro',
    description: 'Extrae hierro de las profundidades de la tierra. El hierro es el material de construcción principal.',
    icon: Pickaxe,
    color: '#64748b',
    effect: (level) => `${ironRateForLevel(level)} hierro/h`,
    nextEffect: (level) => `${ironRateForLevel(level + 1)} hierro/h`,
    energyPerLevel: 10,
  },
  lumber_mill: {
    name: 'Aserradero',
    description: 'Procesa la madera del bosque cercano.',
    icon: Axe,
    color: '#16a34a',
    effect: (level) => `${woodRateForLevel(level)} madera/h`,
    nextEffect: (level) => `${woodRateForLevel(level + 1)} madera/h`,
    energyPerLevel: 10,
  },
  mana_well: {
    name: 'Pozo de Maná',
    description: 'Canaliza energía arcana desde las líneas ley.',
    icon: Sparkles,
    color: '#7c3aed',
    effect: (level) => `${manaRateForLevel(level)} maná/h`,
    nextEffect: (level) => `${manaRateForLevel(level + 1)} maná/h`,
    energyPerLevel: 10,
  },
  library: {
    name: 'Biblioteca',
    description: 'Custodia las cartas y alberga el árbol de investigación.',
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
    energyPerLevel: 5,
  },
  laboratory: {
    name: 'Laboratorio',
    description: 'Transforma recursos en pociones y encantamientos. Nv.2 desbloquea recetas avanzadas.',
    icon: FlaskConical,
    color: '#7c3aed',
    effect: (level) => level === 0 ? 'Sin construir' : level === 1 ? 'Pociones básicas' : level === 2 ? 'Pociones + recetas avanzadas' : 'Todas las recetas',
    nextEffect: (level) => level === 0 ? 'Pociones básicas' : level === 1 ? 'Pociones avanzadas' : 'Recetas de gemas',
    energyPerLevel: 5,
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

export const PRODUCTION_TYPES = ['gold_mine', 'lumber_mill', 'mana_well']

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
  { stat: 'intelligence', label: 'Inteligencia',    icon: Brain,       color: '#7c3aed' },
].map(r => ({ ...r, baseLevelMin: TRAINING_ROOM_BASE_LEVEL_REQUIRED[r.stat] }))

export const STAT_LABEL_MAP = {
  strength: 'FUE', agility: 'AGI', attack: 'ATQ', defense: 'DEF', intelligence: 'INT',
}

/* ─── Laboratorio ────────────────────────────────────────────────────────────── */

export const EFFECT_COLOR = {
  hp_restore: '#dc2626',
  atk_boost:  '#0369a1',
  def_boost:  '#16a34a',
  xp_boost:   '#d97706',
}

export const RUNE_BONUS_LABELS = { attack: 'Atq', defense: 'Def', intelligence: 'Int', agility: 'Agi', max_hp: 'HP', strength: 'Fue' }
export const RUNE_BONUS_COLORS = { attack: '#d97706', defense: '#6b7280', intelligence: '#7c3aed', agility: '#2563eb', max_hp: '#dc2626', strength: '#dc2626' }

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
  { id: 'inicio',        label: 'Inicio',         icon: Home       },
  { id: 'recursos',      label: 'Recursos',        icon: Coins      },
  { id: 'entrenamiento', label: 'Entrenamiento',   icon: Dumbbell   },
  { id: 'laboratorio',   label: 'Laboratorio',     icon: FlaskConical },
  { id: 'biblioteca',    label: 'Biblioteca',      icon: BookOpen   },
]

/* ─── Recursos ───────────────────────────────────────────────────────────────── */

export const RESOURCE_ITEMS = [
  { key: 'wood', icon: Axe,      color: '#16a34a', label: 'Madera', rateKey: 'wood_rate' },
  { key: 'iron', icon: Pickaxe,  color: '#64748b', label: 'Hierro', rateKey: 'iron_rate' },
  { key: 'mana', icon: Sparkles, color: '#7c3aed', label: 'Maná',   rateKey: 'mana_rate' },
]

/* ─── Header resources grid ──────────────────────────────────────────────────── */

export const HEADER_RESOURCES = [
  { key: 'wood',      Icon: Axe,      color: '#16a34a', label: 'Madera',     short: 'Mad'  },
  { key: 'iron',      Icon: Pickaxe,  color: '#64748b', label: 'Hierro',     short: 'Hier' },
  { key: 'mana',      Icon: Sparkles, color: '#7c3aed', label: 'Maná',       short: 'Maná' },
  { key: 'fragments', Icon: Layers,   color: '#0891b2', label: 'Fragmentos', short: 'Frag' },
  { key: 'essence',   Icon: Flame,    color: '#f43f5e', label: 'Esencia',    short: 'Esen' },
]
