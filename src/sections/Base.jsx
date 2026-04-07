import { useState, useEffect, useRef, useReducer } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useTraining, xpThreshold, hasReadyPoint } from '../hooks/useTraining'
import { useTrainingRooms } from '../hooks/useTrainingRooms'
import { usePotions } from '../hooks/usePotions'
import { useHeroRunes } from '../hooks/useHeroRunes'
import { useResearch } from '../hooks/useResearch'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { useBuildings } from '../hooks/useBuildings'
import { useResources } from '../hooks/useResources'
import {
  UNLOCK_TRIGGERS,
  computeBaseLevel,
  buildingUpgradeCost,
  buildingUpgradeDurationMs,
  LAB_BASE_LEVEL_REQUIRED,
  BUILDING_MAX_LEVEL,
  TRAINING_ROOM_BUILD_COST,
  TRAINING_ROOM_BUILD_TIME_MS,
  trainingRoomUpgradeCost,
  trainingRoomUpgradeDurationMs,
  TRAINING_ROOM_BASE_LEVEL_REQUIRED,
  TRAINING_ROOM_MAX_LEVEL,
  ironRateForLevel,
  woodRateForLevel,
  manaRateForLevel,
  xpRateForLevel,
  TRAINING_XP_CAP_HOURS,
  BASE_RUNE_SLOTS,
  RESEARCH_NODES,
} from '../lib/gameConstants.js'
import {
  Coins, Axe, Sparkles, Swords, Wrench, Clock, ChevronRight, Zap, Hammer, BookOpen, Lock,
  Dumbbell, FlaskConical, ShieldCheck, Zap as ZapIcon, Brain, Plus, PackageOpen,
  Home, Shield, Pickaxe, Telescope, Sword, Map, CheckCircle2, Timer, AlertCircle, Castle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Animaciones ─────────────────────────────────────────────────────────────── */

const cardVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
}

/* ─── Metadatos de edificios ─────────────────────────────────────────────────── */

const BUILDING_META = {
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
    effect: (level) => level === 0 ? 'Sin construir' : 'Árbol de investigación activo',
    nextEffect: (level) => level === 0 ? 'Árbol de investigación' : 'Mayor capacidad arcana',
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

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function fmtHours(h) {
  if (h <= 0) return ''
  const totalMins = Math.ceil(h * 60)
  const hh = Math.floor(totalMins / 60)
  const mm = totalMins % 60
  if (hh > 0 && mm > 0) return `${hh}h ${mm}m`
  if (hh > 0) return `${hh}h`
  return `${mm}m`
}

function fmtTime(seconds) {
  if (seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

/* ─── Nivel de Base ──────────────────────────────────────────────────────────── */

// computeBaseLevel importado desde gameConstants — recibe array de edificios
// En el frontend pasamos Object.values(byType) cuando necesitemos el array
function baseLevelFromMap(byType) {
  return computeBaseLevel(Object.values(byType))
}

/* ─── BaseHeader ─────────────────────────────────────────────────────────────── */

const BASE_TIERS = [
  { minLevel: 1,  color: '#64748b', name: 'Asentamiento',          subtitle: 'Una chispa en la oscuridad.' },
  { minLevel: 2,  color: '#b45309', name: 'Campamento',            subtitle: 'Las primeras murallas se alzan.' },
  { minLevel: 3,  color: '#0369a1', name: 'Fortaleza Incipiente',  subtitle: 'Tu nombre empieza a resonar.' },
  { minLevel: 4,  color: '#1d4ed8', name: 'Bastión',               subtitle: 'Los rivales te toman en serio.' },
  { minLevel: 5,  color: '#6d28d9', name: 'Ciudadela',             subtitle: 'Una potencia que no se puede ignorar.' },
  { minLevel: 7,  color: '#be185d', name: 'Fortaleza Épica',       subtitle: 'Tu leyenda precede a tus héroes.' },
  { minLevel: 10, color: '#7f1d1d', name: 'Ciudadela Legendaria',  subtitle: 'Solo los dioses saben tu nombre.' },
]

function getBaseTier(level) {
  let tier = BASE_TIERS[0]
  for (const t of BASE_TIERS) { if (level >= t.minLevel) tier = t }
  return tier
}

function BaseHeader({ byType, resources, research }) {
  const baseLevel = baseLevelFromMap(byType)
  const tier      = getBaseTier(baseLevel)

  const upgradingBuilding = Object.values(byType).find(
    b => b.upgrade_ends_at && new Date(b.upgrade_ends_at) > new Date()
  )
  const activeResearch = research?.active

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        background:  `linear-gradient(135deg, color-mix(in srgb, ${tier.color} 16%, var(--surface)) 0%, var(--surface) 60%)`,
        borderColor: `color-mix(in srgb, ${tier.color} 28%, var(--border))`,
      }}
    >
      {/* accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: tier.color }} />

      <div className="px-5 pt-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Castle size={12} strokeWidth={2.5} style={{ color: tier.color }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: tier.color }}>
                Tu Base
              </span>
            </div>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 38,
              lineHeight: 1,
              letterSpacing: '0.04em',
              color: 'var(--text)',
              marginBottom: 4,
            }}>
              {tier.name}
            </h1>
            <p className="text-[13px] text-text-3 leading-snug">{tier.subtitle}</p>
          </div>

          {/* level badge */}
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center w-[52px] h-[52px] rounded-2xl border"
            style={{
              background:  `color-mix(in srgb, ${tier.color} 10%, var(--surface-2))`,
              borderColor: `color-mix(in srgb, ${tier.color} 30%, var(--border))`,
            }}
          >
            <span className="text-[22px] font-extrabold leading-none" style={{ color: tier.color }}>{baseLevel}</span>
            <span className="text-[9px] font-bold text-text-3 uppercase tracking-wide">nv.</span>
          </div>
        </div>

        {/* status strip */}
        <div
          className="mt-4 pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1"
          style={{ borderColor: `color-mix(in srgb, ${tier.color} 20%, var(--border))` }}
        >
          {upgradingBuilding && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2">
              <Wrench size={11} strokeWidth={2.5} style={{ color: tier.color }} />
              {BUILDING_META[upgradingBuilding.type]?.name ?? 'Edificio'}
              {upgradingBuilding.level === 0 ? ' en construcción' : ' mejorando'}…
            </span>
          )}
          {activeResearch && !upgradingBuilding && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-2">
              <Telescope size={11} strokeWidth={2.5} style={{ color: tier.color }} />
              Investigando…
            </span>
          )}
          {resources && (
            <>
              <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2">
                <Coins size={11} strokeWidth={2} color="#d97706" />{fmt(resources.gold)}
              </span>
              {(resources.wood ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2">
                  <Axe size={11} strokeWidth={2} color="#16a34a" />{fmt(resources.wood)}
                </span>
              )}
              {(resources.iron ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2">
                  <Pickaxe size={11} strokeWidth={2} color="#64748b" />{fmt(resources.iron)}
                </span>
              )}
              {(resources.mana ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[12px] font-semibold text-text-2">
                  <Sparkles size={11} strokeWidth={2} color="#7c3aed" />{fmt(resources.mana)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


/* ─── Temporizador de mejora ─────────────────────────────────────────────────── */

function useUpgradeTimer(building, onUpgradeCollect) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [loading, setLoading]         = useState(false)
  const mountedRef     = useRef(false)
  const collectingRef  = useRef(false)

  useEffect(() => {
    const hasUpgrade = !!building.upgrade_ends_at
    if (!hasUpgrade) {
      setSecondsLeft(null)
      setLoading(false)
      mountedRef.current    = false
      collectingRef.current = false
      return
    }
    const endTime = new Date(building.upgrade_ends_at)

    async function autoCollect() {
      if (collectingRef.current) return
      collectingRef.current = true
      setLoading(true)
      try {
        await apiPost('/api/building-upgrade-collect', { buildingId: building.id })
        onUpgradeCollect()
        setLoading(false)
      } catch (err) {
        toast.error(err.message)
        setLoading(false)
        collectingRef.current = false
      }
    }

    function tick() {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) autoCollect()
    }
    tick()
    requestAnimationFrame(() => { mountedRef.current = true })
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building.upgrade_ends_at, building.id])

  return { secondsLeft, loading, mountedRef }
}

/* ─── BuildingCard ───────────────────────────────────────────────────────────── */

const PRODUCTION_TYPES = ['gold_mine', 'lumber_mill', 'mana_well']

function BuildingCard({ building, resources, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending, nexusRatio, anyUpgrading }) {
  const [optimisticEndsAt, setOptimisticEndsAt] = useState(null)

  useEffect(() => {
    if (building.upgrade_ends_at) setOptimisticEndsAt(null)
  }, [building.upgrade_ends_at])

  const effectiveBuilding = optimisticEndsAt
    ? { ...building, upgrade_started_at: new Date().toISOString(), upgrade_ends_at: optimisticEndsAt }
    : building

  const meta = BUILDING_META[effectiveBuilding.type]
  const { level } = effectiveBuilding
  const hasUpgrade = !!effectiveBuilding.upgrade_ends_at
  const { secondsLeft, loading, mountedRef } = useUpgradeTimer(effectiveBuilding, () => {
    setOptimisticEndsAt(null)
    onUpgradeCollect()
  })

  if (!meta) return null

  const cost = buildingUpgradeCost(building.type, level)
  const Icon = meta.icon
  const totalSeconds = buildingUpgradeDurationMs(level) / 1000
  const elapsed = hasUpgrade ? totalSeconds - (secondsLeft ?? totalSeconds) : 0
  const pct = hasUpgrade ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

  const canAfford = resources
    && (cost.wood === undefined || resources.wood >= cost.wood)
    && (cost.iron === undefined || resources.iron >= cost.iron)
    && (cost.mana === undefined || resources.mana >= cost.mana)
  const blockedByOther = !hasUpgrade && anyUpgrading

  async function handleUpgradeStart() {
    // eslint-disable-next-line react-hooks/purity
    setOptimisticEndsAt(new Date(Date.now() + buildingUpgradeDurationMs(building.level)).toISOString())
    onOptimisticDeduct(cost)
    onUpgradePending(true)
    try {
      await apiPost('/api/building-upgrade-start', { buildingId: building.id })
      onUpgradeStart()
    } catch (err) {
      setOptimisticEndsAt(null)
      onOptimisticDeduct({ wood: -(cost.wood ?? 0), iron: -(cost.iron ?? 0), mana: -(cost.mana ?? 0) })
      onUpgradePending(false)
      toast.error(err.message)
    }
  }

  const costRow = (
    <div className="flex items-center justify-between gap-2 pt-3 border-t border-border mt-auto">
      <div className="flex gap-2 flex-wrap">
        {cost.wood !== undefined && (
          <span className={`flex items-center gap-1 text-[13px] font-semibold ${resources?.wood >= cost.wood ? 'text-success-text' : 'text-error-text'}`}>
            <Axe size={12} strokeWidth={2} />{fmt(cost.wood)}
          </span>
        )}
        {cost.iron !== undefined && (
          <span className={`flex items-center gap-1 text-[13px] font-semibold ${resources?.iron >= cost.iron ? 'text-success-text' : 'text-error-text'}`}>
            <Pickaxe size={12} strokeWidth={2} />{fmt(cost.iron)}
          </span>
        )}
        {cost.mana !== undefined && (
          <span className={`flex items-center gap-1 text-[13px] font-semibold ${resources?.mana >= cost.mana ? 'text-success-text' : 'text-error-text'}`}>
            <Sparkles size={12} strokeWidth={2} />{fmt(cost.mana)}
          </span>
        )}
      </div>
      <motion.button
        className="btn btn--primary btn--sm flex-shrink-0"
        onClick={handleUpgradeStart}
        disabled={!canAfford || blockedByOther}
        title={blockedByOther ? 'Ya hay un edificio en construcción' : undefined}
        whileTap={(!canAfford || blockedByOther) ? {} : { scale: 0.96 }}
        whileHover={(!canAfford || blockedByOther) ? {} : { scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <span>{level === 0 ? 'Construir' : 'Mejorar'}</span><ChevronRight size={13} strokeWidth={2} />
      </motion.button>
    </div>
  )

  const progressRow = (
    <div className="flex flex-col gap-2 pt-3 border-t border-border mt-auto">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[var(--accent)]">→ Nivel {level + 1}</span>
        <span className="flex items-center gap-1 text-[13px] font-semibold text-text-3">
          <Clock size={12} strokeWidth={2} />
          {loading ? 'Aplicando...' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] rounded-full"
          style={{ width: `${pct}%`, transition: mountedRef.current ? 'width 1s linear' : 'none' }}
        />
      </div>
    </div>
  )

  return (
    <div
      className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:border-[var(--accent-border)] transition-[box-shadow,border-color] duration-200"
      style={{ '--accent': meta.color }}
    >
      {/* Header: icono + nombre + stat + nivel */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="w-10 h-10 rounded-[10px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
          <Icon size={20} strokeWidth={1.8} color={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-text leading-none truncate">{meta.name}</h3>
            {level === 0 ? (
              <span className="text-[11px] font-bold text-text-3 bg-surface-2 border border-border rounded-[5px] px-1.5 py-[3px] leading-none flex-shrink-0">
                Sin construir
              </span>
            ) : (
              <span className="text-[12px] font-bold text-[var(--accent)] bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-[5px] px-1.5 py-[3px] leading-none flex-shrink-0">
                Nv.{level}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {level === 0 ? (
              <span className="text-[13px] font-semibold text-text-3">→ {meta.nextEffect(0)}</span>
            ) : (
              <>
                <span className="text-[13px] font-semibold text-text-2">{meta.effect(level)}</span>
                {!hasUpgrade && (
                  <span className="text-[12px] text-text-3">→ {meta.nextEffect(level)}</span>
                )}
              </>
            )}
            {nexusRatio !== undefined && nexusRatio < 1 && (
              <span className="text-[11px] font-semibold text-[#d97706]">· ⚡ {Math.round(nexusRatio * 100)}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer: coste, progreso o nivel máximo */}
      <div className="px-4 pb-4 border-t border-border">
        {hasUpgrade ? progressRow : level >= BUILDING_MAX_LEVEL ? (
          <div className="flex items-center justify-center pt-3 mt-auto">
            <span className="text-[12px] font-bold text-text-3 uppercase tracking-[0.08em]">Nivel máximo</span>
          </div>
        ) : costRow}
      </div>
    </div>
  )
}

/* ─── LockedBuildingCard ─────────────────────────────────────────────────────── */

// Derivado automáticamente de UNLOCK_TRIGGERS (gameConstants.js) + BUILDING_META
// No hardcodear: si cambia el árbol de desbloqueo, este objeto se actualiza solo
const UNLOCK_REQUIREMENTS = Object.fromEntries(
  UNLOCK_TRIGGERS.flatMap(t =>
    t.unlocks.map(u => [u, { name: BUILDING_META[t.type]?.name ?? t.type, level: t.level }])
  )
)

function LockedBuildingCard({ type }) {
  const meta = BUILDING_META[type]
  const req  = UNLOCK_REQUIREMENTS[type] ?? { name: 'Requisito pendiente', level: '?' }
  if (!meta) return null
  const Icon = meta.icon
  return (
    <div
      className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] h-full opacity-40 pointer-events-none"
      style={{ '--accent': meta.color }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
          <Icon size={18} strokeWidth={1.8} color={meta.color} />
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold text-text truncate">{meta.name}</h3>
          <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-3 border-y border-border bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]">
        <p className="text-[13px] text-text-3 text-center">{meta.description}</p>
      </div>
      <div className="px-4 py-3">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3">
          <Lock size={11} strokeWidth={2.5} />
          Requiere {req.name} Nv.{req.level}
        </p>
      </div>
    </div>
  )
}

/* ─── Salas de entrenamiento ─────────────────────────────────────────────────── */

const TRAINING_ROOMS = [
  { stat: 'strength',     label: 'Fuerza',       icon: Dumbbell,    color: '#dc2626' },
  { stat: 'agility',      label: 'Agilidad',      icon: ZapIcon,     color: '#d97706' },
  { stat: 'attack',       label: 'Ataque',         icon: Swords,      color: '#0369a1' },
  { stat: 'defense',      label: 'Defensa',        icon: ShieldCheck, color: '#16a34a' },
  { stat: 'intelligence', label: 'Inteligencia',   icon: Brain,       color: '#7c3aed' },
].map(r => ({ ...r, baseLevelMin: TRAINING_ROOM_BASE_LEVEL_REQUIRED[r.stat] }))

const STAT_LABEL_MAP = {
  strength: 'FUE', agility: 'AGI', attack: 'ATQ', defense: 'DEF', intelligence: 'INT',
}

// BUILD_COST, roomUpgradeCost y xpRate importados desde gameConstants

/* ─── Laboratorio ────────────────────────────────────────────────────────────── */

const EFFECT_COLOR = {
  hp_restore: '#dc2626',
  atk_boost:  '#0369a1',
  def_boost:  '#16a34a',
  xp_boost:   '#d97706',
}

function LaboratorySection({ labLevel, potions, resources, onCraft }) {
  const availablePotions = potions.filter(p => p.min_lab_level <= labLevel)

  function canAfford(p) {
    if (!resources) return false
    return resources.gold >= p.recipe_gold
      && resources.wood >= p.recipe_wood
      && resources.mana >= p.recipe_mana
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">Recetas disponibles</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {availablePotions.map(p => {
          const affordable = canAfford(p)
          const full       = p.quantity >= 5
          const color      = EFFECT_COLOR[p.effect_type] ?? '#475569'

          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 hover:border-border-2 transition-[border-color] duration-150"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[14px] font-extrabold"
                style={{ background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, color }}
              >
                {p.quantity}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-text truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {p.recipe_gold > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.gold >= p.recipe_gold ? 'text-text-3' : 'text-error-text'}`}>
                      <Coins size={10} strokeWidth={2} />{p.recipe_gold}
                    </span>
                  )}
                  {p.recipe_wood > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.wood >= p.recipe_wood ? 'text-text-3' : 'text-error-text'}`}>
                      <Axe size={10} strokeWidth={2} />{p.recipe_wood}
                    </span>
                  )}
                  {p.recipe_mana > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.mana >= p.recipe_mana ? 'text-text-3' : 'text-error-text'}`}>
                      <Sparkles size={10} strokeWidth={2} />{p.recipe_mana}
                    </span>
                  )}
                  <span className="text-[11px] text-text-3 opacity-60">máx.5</span>
                </div>
              </div>
              <motion.button
                className="btn btn--primary btn--sm flex-shrink-0"
                onClick={() => onCraft(p.id)}
                disabled={!affordable || full}
                whileTap={(!affordable || full) ? {} : { scale: 0.96 }}
                title={full ? 'Inventario lleno' : !affordable ? 'Recursos insuficientes' : undefined}
              >
                <Plus size={13} strokeWidth={2.5} />
              </motion.button>
            </div>
          )
        })}

        {availablePotions.length === 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            Sube el Laboratorio para desbloquear recetas
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── Runas ──────────────────────────────────────────────────────────────────── */

const RUNE_BONUS_LABELS = { attack: 'Atq', defense: 'Def', intelligence: 'Int', agility: 'Agi', max_hp: 'HP', strength: 'Fue' }
const RUNE_BONUS_COLORS = { attack: '#d97706', defense: '#6b7280', intelligence: '#7c3aed', agility: '#2563eb', max_hp: '#dc2626', strength: '#dc2626' }

function RunesSection({ labLevel, catalog, inventory, resources, onCraft }) {
  const availableRunes = catalog.filter(r => r.min_lab_level <= labLevel)
  const inventoryMap   = Object.fromEntries(inventory.map(ir => [ir.rune_id, ir.quantity]))

  function canAfford(r) {
    if (!resources) return false
    return resources.gold >= r.recipe_gold
      && resources.wood >= r.recipe_wood
      && resources.mana >= r.recipe_mana
  }

  function bonusText(bonuses) {
    return (bonuses ?? []).map(({ stat, value }) => `+${value} ${RUNE_BONUS_LABELS[stat] ?? stat}`).join(' · ')
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">Crafteo de Runas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {availableRunes.map(r => {
          const affordable = canAfford(r)
          const qty        = inventoryMap[r.id] ?? 0
          const mainBonus  = r.bonuses?.[0]
          const color      = RUNE_BONUS_COLORS[mainBonus?.stat] ?? '#475569'

          return (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 hover:border-border-2 transition-[border-color] duration-150"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-extrabold"
                style={{ background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, color }}
              >
                {qty > 0 ? qty : '✦'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-text truncate">{r.name}</p>
                <p className="text-[11px] text-text-3 mt-0.5">{bonusText(r.bonuses)}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {r.recipe_gold > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.gold >= r.recipe_gold ? 'text-text-3' : 'text-error-text'}`}>
                      <Coins size={10} strokeWidth={2} />{r.recipe_gold}
                    </span>
                  )}
                  {r.recipe_wood > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.wood >= r.recipe_wood ? 'text-text-3' : 'text-error-text'}`}>
                      <Axe size={10} strokeWidth={2} />{r.recipe_wood}
                    </span>
                  )}
                  {r.recipe_mana > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.mana >= r.recipe_mana ? 'text-text-3' : 'text-error-text'}`}>
                      <Sparkles size={10} strokeWidth={2} />{r.recipe_mana}
                    </span>
                  )}
                </div>
              </div>
              <motion.button
                className="btn btn--primary btn--sm flex-shrink-0"
                onClick={() => onCraft(r.id)}
                disabled={!affordable}
                whileTap={!affordable ? {} : { scale: 0.96 }}
                title={!affordable ? 'Recursos insuficientes' : undefined}
              >
                <Plus size={13} strokeWidth={2.5} />
              </motion.button>
            </div>
          )
        })}

        {availableRunes.length === 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            Sube el Laboratorio a Nv.2 para desbloquear el crafteo de runas
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── Pill navigation ────────────────────────────────────────────────────────── */

const ZONES = [
  { id: 'inicio',        label: 'Inicio',         icon: Home       },
  { id: 'recursos',      label: 'Recursos',        icon: Coins      },
  { id: 'entrenamiento', label: 'Entrenamiento',   icon: Dumbbell   },
  { id: 'laboratorio',   label: 'Laboratorio',     icon: FlaskConical },
  { id: 'biblioteca',    label: 'Biblioteca',      icon: BookOpen   },
]

function ZonePills({ active, onChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-border -mt-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {ZONES.map(z => {
        const Icon = z.icon
        const isActive = active === z.id
        return (
          <button
            key={z.id}
            onClick={() => onChange(z.id)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap transition-[color,border-color] duration-150 bg-transparent border-x-0 border-t-0 font-[inherit] ${
              isActive
                ? 'border-b-[var(--blue-600)] text-[var(--blue-700)]'
                : 'border-b-transparent text-text-3 hover:text-text'
            }`}
          >
            <Icon size={14} strokeWidth={2} />
            {z.label}
          </button>
        )
      })}
    </div>
  )
}

/* ─── Zona: Inicio ───────────────────────────────────────────────────────────── */

function InicioZone({ byType, nexusData, trainingRooms, trainingProgress, potions, onGoTo }) {
  const progressByStat = Object.fromEntries(trainingProgress.map(r => [r.stat, r]))
  const anyTrainReady  = trainingRooms.some(r => hasReadyPoint(progressByStat[r.stat], r.level))
  const builtCount     = trainingRooms.length

  const labLevel       = byType['laboratory']?.level ?? 0
  const labUnlocked    = byType['laboratory']?.unlocked !== false && labLevel > 0
  const potionCount    = potions.reduce((s, p) => s + (p.quantity ?? 0), 0)

  // Edificio en construcción/mejora
  const upgradingBuilding = Object.values(byType).find(
    b => b.upgrade_ends_at && new Date(b.upgrade_ends_at) > new Date()
  )
  const upgradingMeta = upgradingBuilding
    ? BUILDING_META[upgradingBuilding.type]
    : null

  const zoneCards = [
    {
      id:      'recursos',
      label:   'Recursos',
      icon:    Pickaxe,
      color:   '#64748b',
      alert:   !!upgradingBuilding,
      summary: nexusData
        ? nexusData.deficit
          ? `Déficit −${Math.abs(nexusData.balance)} ⚡`
          : `Energía +${nexusData.balance} ⚡`
        : 'Gestiona tus edificios',
      summaryClass: nexusData
        ? nexusData.deficit ? 'font-bold text-[#dc2626]' : 'font-bold text-[#0891b2]'
        : undefined,
      detail:  upgradingBuilding
        ? `${upgradingMeta?.name ?? 'Edificio'} ${upgradingBuilding.level === 0 ? 'en construcción' : 'mejorando'}…`
        : null,
    },
    {
      id:       'entrenamiento',
      label:    'Entrenamiento',
      icon:     Dumbbell,
      color:    '#dc2626',
      summary:  builtCount > 0
        ? anyTrainReady ? '¡Puntos listos para recoger!' : `${builtCount} sala${builtCount !== 1 ? 's' : ''} activa${builtCount !== 1 ? 's' : ''}`
        : 'Construye tu primera sala',
      alert:    anyTrainReady,
    },
    {
      id:       'laboratorio',
      label:    'Laboratorio',
      icon:     FlaskConical,
      color:    '#7c3aed',
      summary:  labUnlocked ? `${potionCount} pociones en stock` : 'Laboratorio bloqueado',
    },
  ]

  return (
    <motion.div className="flex flex-col gap-5" variants={cardVariants} initial="initial" animate="animate">
      {/* Zone cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {zoneCards.map(z => {
          const Icon = z.icon
          return (
            <button
              key={z.id}
              onClick={() => onGoTo(z.id)}
              className="text-left flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4 hover:border-border-2 hover:shadow-[var(--shadow-md)] transition-[border-color,box-shadow] duration-200"
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `color-mix(in srgb,${z.color} 12%,var(--surface-2))` }}
                >
                  <Icon size={15} strokeWidth={2} style={{ color: z.color }} />
                </div>
                {z.alert && (
                  <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse flex-shrink-0" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-bold text-text">{z.label}</p>
                <p className={`text-[12px] mt-0.5 ${z.summaryClass ?? (z.alert ? 'font-semibold text-[#16a34a]' : 'text-text-3')}`}>{z.summary}</p>
                {z.detail && (
                  <p className="text-[11px] mt-1 text-text-3">{z.detail}</p>
                )}
              </div>
              <span className="text-[11px] font-semibold text-text-3 flex items-center gap-1">
                Gestionar <ChevronRight size={10} strokeWidth={2.5} />
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-text-3 text-center px-4">
        El nivel de tu base crecerá con el progreso de tus edificios — y pronto, con las victorias de tus héroes.
      </p>
    </motion.div>
  )
}

/* ─── Energy strip ───────────────────────────────────────────────────────────── */

function EnergyStrip({ nexusData }) {
  if (!nexusData) return null
  const { produced, consumed, balance, deficit, barPct, efficiency } = nexusData
  return (
    <div className={`flex flex-col gap-2 rounded-xl border px-4 py-3 ${
      deficit
        ? 'border-[color-mix(in_srgb,#dc2626_30%,var(--border))] bg-[color-mix(in_srgb,#dc2626_5%,var(--surface))]'
        : 'border-border bg-surface'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Zap size={13} strokeWidth={2} color="#0891b2" />
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-3">Energía</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold text-text-2">
            <span className="text-[#0891b2] font-bold">{produced}</span> producida
          </span>
          <span className="text-border">·</span>
          <span className="text-[12px] font-semibold text-text-2">
            <span className="font-bold text-text">{consumed}</span> consumida
          </span>
          <span className="text-border">·</span>
          <span className={`text-[12px] font-bold ${deficit ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
            {deficit ? `−${Math.abs(balance)} déficit` : `+${balance} excedente`}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-[400ms] ${deficit ? 'bg-[#dc2626]' : 'bg-[#0891b2]'}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      {deficit && (
        <p className="text-[11px] text-[#dc2626] font-semibold">
          Producción reducida al {efficiency}% — mejora el Nexo Arcano para recuperar rendimiento
        </p>
      )}
    </div>
  )
}

/* ─── Resource header ────────────────────────────────────────────────────────── */

const RESOURCE_ITEMS = [
  { key: 'wood', icon: Axe,      color: '#16a34a', label: 'Madera', rateKey: 'wood_rate' },
  { key: 'iron', icon: Pickaxe,  color: '#64748b', label: 'Hierro', rateKey: 'iron_rate' },
  { key: 'mana', icon: Sparkles, color: '#7c3aed', label: 'Maná',   rateKey: 'mana_rate' },
]

function ResourcesHeader({ resources }) {
  if (!resources) return null

  return (
    <div className="grid grid-cols-3 gap-0 rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)] overflow-hidden">
      {RESOURCE_ITEMS.map((item, idx) => {
        const Icon  = item.icon
        const value = resources[item.key] ?? 0
        const isLast = idx === RESOURCE_ITEMS.length - 1

        return (
          <div
            key={item.key}
            className={`flex flex-col items-center justify-center gap-1.5 py-5 px-3 relative ${!isLast ? 'border-r border-border' : ''}`}
          >
            {/* Glow de fondo */}
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%,${item.color} 0%,transparent 70%)` }}
            />

            {/* Icono */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `color-mix(in srgb,${item.color} 14%,var(--surface-2))` }}
            >
              <Icon size={17} strokeWidth={2} style={{ color: item.color }} />
            </div>

            {/* Valor */}
            <p className="text-[26px] font-extrabold text-text leading-none tabular-nums">
              {fmt(value)}
            </p>

            {/* Label + rate */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[11px] font-semibold text-text-3">{item.label}</span>
              </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Zona: Recursos ─────────────────────────────────────────────────────────── */

function RecursosZone({ byType, effectiveResources, nexusData, nexusRatio, anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending }) {
  const resourceBuildings = ['energy_nexus', 'lumber_mill', 'gold_mine', 'mana_well']

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <ResourcesHeader resources={effectiveResources} />
      <EnergyStrip nexusData={nexusData} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {resourceBuildings.map(type => {
          const b = byType[type]
          if (!b) return null
          if (b.unlocked === false) return <LockedBuildingCard key={type} type={type} />
          return (
            <BuildingCard
              key={b.id}
              building={b}
              resources={effectiveResources}
              nexusRatio={PRODUCTION_TYPES.includes(type) ? nexusRatio : undefined}
              anyUpgrading={anyUpgrading}
              onUpgradeStart={onUpgradeStart}
              onUpgradeCollect={onUpgradeCollect}
              onOptimisticDeduct={onOptimisticDeduct}
              onUpgradePending={onUpgradePending}
            />
          )
        })}
      </div>
    </motion.div>
  )
}

/* ─── RoomCard ───────────────────────────────────────────────────────────────── */

function RoomCard({ room, roomData, progressRow, resources, baseLevel, mutPending, onBuild, onUpgrade, onBuildCollect }) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const collectingRef = useRef(false)

  const Icon           = room.icon
  const exists         = !!roomData
  const isBuilt        = exists && roomData.built_at !== null
  const building_ends_at = roomData?.building_ends_at ?? null
  const isConstructing = exists && !!building_ends_at
  const roomLevel      = roomData?.level ?? 0
  const lockedByBase   = !exists && baseLevel < room.baseLevelMin

  // Timer de construcción/mejora
  useEffect(() => {
    if (!isConstructing) { setSecondsLeft(null); collectingRef.current = false; return }
    const endTime = new Date(building_ends_at)
    function tick() {
      const rem = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setSecondsLeft(rem)
      if (rem === 0 && !collectingRef.current) {
        collectingRef.current = true
        onBuildCollect()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building_ends_at])

  const rate   = xpRateForLevel(isBuilt ? roomLevel : 1)
  const xp     = isBuilt && progressRow
    ? progressRow.xp_bank + Math.min(TRAINING_XP_CAP_HOURS, (Date.now() - new Date(progressRow.last_collected_at).getTime()) / 3_600_000) * rate
    : 0
  const thr    = xpThreshold(progressRow?.total_gained ?? 0)
  const xpPct  = isBuilt && progressRow ? Math.min(100, Math.round((xp / thr) * 100)) : 0
  const gained = progressRow?.total_gained ?? 0
  const ready  = isBuilt && progressRow ? xp >= thr : false

  const upgCost   = isBuilt ? trainingRoomUpgradeCost(roomLevel) : TRAINING_ROOM_BUILD_COST
  const canAfford = resources
    ? resources.wood >= upgCost.wood && resources.iron >= upgCost.iron
    : false

  // Duración de construcción para la barra de progreso
  const buildDurationSec = isConstructing
    ? (isBuilt ? trainingRoomUpgradeDurationMs(roomLevel) / 1000 : TRAINING_ROOM_BUILD_TIME_MS / 1000)
    : 0
  const buildElapsed = buildDurationSec - (secondsLeft ?? buildDurationSec)
  const buildPct = buildDurationSec > 0 ? Math.min(100, Math.round((buildElapsed / buildDurationSec) * 100)) : 0

  const cardStyle = ready
    ? { borderColor: `color-mix(in srgb,${room.color} 35%,var(--border))`, background: `color-mix(in srgb,${room.color} 4%,var(--surface))` }
    : isConstructing
      ? { borderColor: `color-mix(in srgb,#0891b2 25%,var(--border))`, background: `color-mix(in srgb,#0891b2 3%,var(--surface))` }
      : {}

  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden transition-[border-color,box-shadow] duration-200 ${
        lockedByBase
          ? 'border-dashed border-border bg-surface opacity-50 pointer-events-none'
          : ready
            ? 'shadow-[var(--shadow-sm)] border-border'
            : isBuilt
              ? 'border-border bg-surface hover:border-border-2'
              : isConstructing
                ? 'border-border bg-surface'
                : 'border-dashed border-border bg-surface'
      }`}
      style={cardStyle}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb,${room.color} ${isBuilt ? '15%' : '8%'},var(--surface-2))` }}
        >
          <Icon size={18} strokeWidth={isBuilt ? 2 : 1.5} style={{ color: isBuilt ? room.color : 'var(--text-3)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[14px] font-bold leading-none ${isBuilt || isConstructing ? 'text-text' : 'text-text-3'}`}>
              {room.label}
            </p>
            {isBuilt ? (
              <span className="text-[11px] font-bold px-1.5 py-[3px] rounded-md leading-none flex-shrink-0"
                style={{ color: room.color, background: `color-mix(in srgb,${room.color} 12%,var(--surface))` }}>
                Nv.{roomLevel}
              </span>
            ) : isConstructing ? (
              <span className="text-[11px] font-semibold text-[#0891b2] flex-shrink-0">Construyendo…</span>
            ) : lockedByBase ? (
              <span className="text-[11px] text-text-3 flex-shrink-0 flex items-center gap-1">
                <Lock size={10} strokeWidth={2.5} />Base {room.baseLevelMin}
              </span>
            ) : (
              <span className="text-[11px] text-text-3 flex-shrink-0">Sin construir</span>
            )}
          </div>
          <p className="text-[11px] text-text-3 mt-0.5">
            {isBuilt ? `${rate} XP/h` : `${xpRateForLevel(1)} XP/h al construir`}
          </p>
        </div>
      </div>

      {/* Contenido central */}
      {isConstructing ? (
        <div className="px-4 pb-3 border-t border-border pt-3 flex flex-col gap-2">
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#0891b2] transition-[width] duration-[1000ms] linear"
              style={{ width: `${buildPct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-3">Construcción en curso</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#0891b2]">
              <Clock size={10} strokeWidth={2} />
              {secondsLeft !== null ? fmtTime(secondsLeft) : '…'}
            </span>
          </div>
        </div>
      ) : isBuilt ? (
        <div className="px-4 pb-3 flex flex-col gap-2 border-t border-border pt-3">
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
              style={{ width: `${xpPct}%`, background: room.color }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-3">{progressRow ? `${xp.toFixed(1)} / ${thr} XP` : '—'}</span>
            {ready
              ? <span className="text-[11px] font-bold" style={{ color: room.color }}>¡Listo!</span>
              : <span className="text-[11px] text-text-3">{progressRow && thr - xp > 0 ? fmtHours((thr - xp) / rate) : ''}</span>
            }
          </div>
          {gained > 0 && (
            <p className="text-[11px] font-semibold" style={{ color: room.color }}>
              +{gained} {STAT_LABEL_MAP[room.stat]} ganados en total
            </p>
          )}
        </div>
      ) : (
        <div className="px-4 pb-3 border-t border-border pt-3">
          <p className="text-[12px] text-text-3 leading-relaxed">
            {lockedByBase
              ? `Requiere base nivel ${room.baseLevelMin} para construir.`
              : `Construye esta sala para entrenar ${room.label.toLowerCase()} de forma pasiva.`
            }
          </p>
        </div>
      )}

      {/* Acción — no se muestra cuando está construyendo */}
      {!isConstructing && !lockedByBase && (
        <div className="px-4 pb-4 mt-auto">
          {isBuilt && roomLevel >= TRAINING_ROOM_MAX_LEVEL ? (
            <div className="flex items-center justify-center pt-3 border-t border-border">
              <span className="text-[12px] font-bold text-text-3 uppercase tracking-[0.08em]">Nivel máximo</span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`flex items-center gap-1 text-[12px] font-semibold ${resources?.wood >= upgCost.wood ? 'text-text-3' : 'text-error-text'}`}>
                  <Axe size={11} strokeWidth={2} />{fmt(upgCost.wood)}
                </span>
                <span className={`flex items-center gap-1 text-[12px] font-semibold ${resources?.iron >= upgCost.iron ? 'text-text-3' : 'text-error-text'}`}>
                  <Pickaxe size={11} strokeWidth={2} />{fmt(upgCost.iron)}
                </span>
              </div>
              <motion.button
                className="btn btn--primary btn--sm flex-shrink-0"
                onClick={() => isBuilt ? onUpgrade() : onBuild()}
                disabled={!canAfford || mutPending}
                whileTap={(!canAfford || mutPending) ? {} : { scale: 0.96 }}
              >
                {isBuilt ? (
                  <><ChevronRight size={12} strokeWidth={2.5} />Mejorar</>
                ) : (
                  <><Hammer size={12} strokeWidth={2.5} />Construir</>
                )}
              </motion.button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Zona: Entrenamiento ────────────────────────────────────────────────────── */

function EntrenamientoZone({ trainingRooms, trainingProgress, resources, userId, heroId, byType }) {
  const queryClient = useQueryClient()

  const baseLevel      = baseLevelFromMap(byType)
  const roomByStat     = Object.fromEntries(trainingRooms.map(r => [r.stat, r]))
  const progressByStat = Object.fromEntries(trainingProgress.map(r => [r.stat, r]))
  // Solo salas completamente construidas (built_at != null) generan XP y pueden recoger
  const builtRooms  = trainingRooms.filter(r => r.built_at !== null)
  const anyReady    = builtRooms.some(r => hasReadyPoint(progressByStat[r.stat], r.level))
  // Sin datos de progreso + salas construidas → inicializar hero_training con un collect silencioso
  const needsInit = heroId && builtRooms.length > 0 && trainingProgress.length === 0
  useEffect(() => {
    if (!needsInit) return
    apiPost('/api/training-collect', { heroId })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.training(heroId) }))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsInit, heroId])

  const buildMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-room-build', { stat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      toast.success('¡Construcción iniciada!')
    },
    onError: err => toast.error(err.message),
  })

  const buildCollectMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-room-build-collect', { stat }),
    onSuccess: (_, _stat) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) })
      toast.success('¡Sala lista!')
    },
    onError: err => toast.error(err.message),
  })

  const upgradeMutation = useMutation({
    mutationFn: (stat) => apiPost('/api/training-room-upgrade', { stat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingRooms(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      toast.success('¡Sala mejorada!')
    },
    onError: err => toast.error(err.message),
  })

  const collectMutation = useMutation({
    mutationFn: () => apiPost('/api/training-collect', { heroId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.training(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      const names = Object.entries(data.gained ?? {}).map(([stat, pts]) => `+${pts} ${STAT_LABEL_MAP[stat]}`)
      toast.success(names.length > 0 ? `¡Entrenamiento! ${names.join(' · ')}` : 'Sincronizado')
    },
    onError: err => toast.error(err.message),
  })

  const mutPending = buildMutation.isPending || upgradeMutation.isPending || collectMutation.isPending

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">

      {/* Header con Recoger todo */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-text-3">Salas de entrenamiento</p>
        {anyReady && (
          <motion.button
            className="btn btn--primary btn--sm"
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending}
            whileTap={{ scale: 0.96 }}
          >
            <PackageOpen size={13} strokeWidth={2} />
            Recoger todo
          </motion.button>
        )}
      </div>

      {/* Grid de salas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TRAINING_ROOMS.map(room => (
          <RoomCard
            key={room.stat}
            room={room}
            roomData={roomByStat[room.stat]}
            progressRow={progressByStat[room.stat]}
            resources={resources}
            baseLevel={baseLevel}
            mutPending={mutPending}
            onBuild={() => buildMutation.mutate(room.stat)}
            onUpgrade={() => upgradeMutation.mutate(room.stat)}
            onBuildCollect={() => buildCollectMutation.mutate(room.stat)}
          />
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Zona: Laboratorio ──────────────────────────────────────────────────────── */

// LAB_BASE_LEVEL_REQUIRED importado desde gameConstants

function LaboratorioZone({ byType, effectiveResources, potions, runesCatalog, runesInventory, anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending, onCraft, onRuneCraft }) {
  const lab       = byType['laboratory']
  const baseLevel = baseLevelFromMap(byType)

  // Lab no existe en DB (no debería pasar en cuentas nuevas)
  if (!lab) return null

  // Lab existe pero requiere nivel de base para construirlo
  if (lab.level === 0 && !lab.upgrade_ends_at && baseLevel < LAB_BASE_LEVEL_REQUIRED) {
    const meta = BUILDING_META['laboratory']
    const Icon = meta.icon
    return (
      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <div
          className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] opacity-60"
          style={{ '--accent': meta.color }}
        >
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
              <Icon size={18} strokeWidth={1.8} color={meta.color} />
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-text truncate">{meta.name}</h3>
              <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 py-3 border-y border-border bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]">
            <p className="text-[13px] text-text-3 text-center">{meta.description}</p>
          </div>
          <div className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3">
              <Lock size={11} strokeWidth={2.5} />
              Requiere base nivel {LAB_BASE_LEVEL_REQUIRED} para construir.
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <BuildingCard
        building={lab}
        resources={effectiveResources}
        anyUpgrading={anyUpgrading}
        onUpgradeStart={onUpgradeStart}
        onUpgradeCollect={onUpgradeCollect}
        onOptimisticDeduct={onOptimisticDeduct}
        onUpgradePending={onUpgradePending}
      />

      {lab.level >= 1 && !lab.upgrade_ends_at && (
        <div className="flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <LaboratorySection
              labLevel={lab.level}
              potions={potions}
              resources={effectiveResources}
              onCraft={onCraft}
            />
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <RunesSection
              labLevel={lab.level}
              catalog={runesCatalog}
              inventory={runesInventory}
              resources={effectiveResources}
              onCraft={onRuneCraft}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
}

/* ─── Zona: Biblioteca ───────────────────────────────────────────────────────── */

const BRANCH_META = {
  combat:     { label: 'Combate',     icon: Sword,     color: '#dc2626' },
  expedition: { label: 'Expedición',  icon: Map,       color: '#0369a1' },
  crafting:   { label: 'Artesanía',   icon: Hammer,    color: '#b45309' },
  magic:      { label: 'Magia',       icon: Sparkles,  color: '#7c3aed' },
}

const BRANCH_ORDER = ['combat', 'expedition', 'crafting', 'magic']

function fmtCountdown(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return '¡Listo!'
  const totalSecs = Math.ceil(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function ResearchNodeCard({ node, state, isActive, activeNode, resources, onStart, onCollect, startPending, collectPending }) {
  // state: 'locked' | 'available' | 'active' | 'completed'
  const bm = BRANCH_META[node.branch]
  const isReady = isActive && new Date(activeNode?.ends_at) <= new Date()

  const stateColors = {
    locked:    { bg: 'bg-surface',   border: 'border-border',                           text: 'text-text-3'  },
    available: { bg: 'bg-surface',   border: 'border-border hover:border-[var(--blue-400)]', text: 'text-text' },
    active:    { bg: 'bg-surface-2', border: 'border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]', text: 'text-text' },
    completed: { bg: 'bg-surface',   border: 'border-[color-mix(in_srgb,var(--accent)_30%,var(--border))]', text: 'text-text' },
  }

  const sc = stateColors[state] ?? stateColors.locked

  const canAfford = resources
    ? resources.gold >= node.cost.gold && resources.iron >= node.cost.iron && resources.mana >= node.cost.mana
    : false

  return (
    <div
      className={`relative flex flex-col gap-1.5 p-3 rounded-xl border transition-all duration-150 ${sc.bg} ${sc.border}`}
      style={{ '--accent': bm.color }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {state === 'completed' && (
            <CheckCircle2 size={13} strokeWidth={2.5} style={{ color: bm.color, flexShrink: 0 }} />
          )}
          {state === 'active' && (
            <Timer size={13} strokeWidth={2.5} style={{ color: bm.color, flexShrink: 0 }} />
          )}
          {state === 'locked' && (
            <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
          )}
          {state === 'available' && (
            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: bm.color, opacity: 0.6 }} />
          )}
          <span className={`text-[12px] font-semibold truncate ${sc.text}`}>{node.name}</span>
        </div>
        <span className="text-[10px] text-text-3 flex-shrink-0 font-mono">
          {node.duration_hours >= 24
            ? `${node.duration_hours / 24}d`
            : `${node.duration_hours}h`}
        </span>
      </div>

      {/* Description */}
      <p className="text-[11px] text-text-3 leading-snug">{node.description}</p>

      {/* Cost / timer / button */}
      {state === 'available' && (
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-2 text-[10px] text-text-3 flex-wrap">
            {node.cost.gold  > 0 && <span className="text-[#d97706]">{node.cost.gold}g</span>}
            {node.cost.iron  > 0 && <span className="text-[#64748b]">{node.cost.iron}h</span>}
            {node.cost.mana  > 0 && <span className="text-[#7c3aed]">{node.cost.mana}m</span>}
          </div>
          <button
            className="btn btn--primary btn--sm flex-shrink-0"
            style={{ fontSize: '11px', padding: '2px 10px', height: '24px', minHeight: 'unset' }}
            onClick={() => onStart(node.id)}
            disabled={startPending || !canAfford}
            title={!canAfford ? 'Recursos insuficientes' : undefined}
          >
            Investigar
          </button>
        </div>
      )}

      {state === 'active' && (
        <div className="flex items-center justify-between gap-2 mt-0.5">
          {isReady ? (
            <span className="text-[11px] font-bold" style={{ color: bm.color }}>¡Listo para recoger!</span>
          ) : (
            <span className="text-[11px] text-text-3 font-mono">{fmtCountdown(activeNode.ends_at)}</span>
          )}
          {isReady && (
            <button
              className="btn btn--primary btn--sm flex-shrink-0"
              style={{ fontSize: '11px', padding: '2px 10px', height: '24px', minHeight: 'unset' }}
              onClick={() => onCollect(node.id)}
              disabled={collectPending}
            >
              Recoger
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ResearchBranch({ branch, nodesInBranch, completedSet, activeNode, resources, onStart, onCollect, startPending, collectPending }) {
  const bm = BRANCH_META[branch]
  const BranchIcon = bm.icon

  return (
    <div className="flex flex-col gap-2">
      {/* Branch header */}
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb,${bm.color} 12%,var(--surface-2))` }}>
          <BranchIcon size={12} strokeWidth={2} style={{ color: bm.color }} />
        </div>
        <span className="text-[12px] font-bold text-text">{bm.label}</span>
      </div>

      {/* Nodes */}
      <div className="flex flex-col gap-2">
        {nodesInBranch.map((node, idx) => {
          const prereqDone = !node.prerequisite || completedSet.has(node.prerequisite)
          const isCompleted = completedSet.has(node.id)
          const isActive    = activeNode?.node_id === node.id
          let state = 'locked'
          if (isCompleted) state = 'completed'
          else if (isActive) state = 'active'
          else if (prereqDone) state = 'available'

          return (
            <div key={node.id} className="relative">
              {/* Connector line between nodes */}
              {idx > 0 && (
                <div
                  className="absolute left-[18px] -top-2 w-px h-2"
                  style={{
                    background: nodesInBranch[idx - 1] && completedSet.has(nodesInBranch[idx - 1].id)
                      ? bm.color
                      : 'var(--border)',
                    opacity: 0.6,
                  }}
                />
              )}
              <ResearchNodeCard
                node={node}
                state={state}
                isActive={isActive}
                activeNode={activeNode}
                resources={resources}
                onStart={onStart}
                onCollect={onCollect}
                startPending={startPending}
                collectPending={collectPending}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BibliotecaZone({ byType, research, resources, onResearchStart, onResearchCollect, startPending, collectPending, anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending }) {
  const library = byType['library']
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  // Tick para actualizar el countdown cada segundo
  useEffect(() => {
    if (!research.active) return
    const id = setInterval(forceUpdate, 1000)
    return () => clearInterval(id)
  }, [research.active])

  const completedSet = new Set(research.completed ?? [])
  const activeNode   = research.active
  const byBranch     = Object.fromEntries(BRANCH_ORDER.map(b => [b, RESEARCH_NODES.filter(n => n.branch === b)]))

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      {library && (
        <BuildingCard
          building={library}
          resources={resources}
          anyUpgrading={anyUpgrading}
          onUpgradeStart={onUpgradeStart}
          onUpgradeCollect={onUpgradeCollect}
          onOptimisticDeduct={onOptimisticDeduct}
          onUpgradePending={onUpgradePending}
        />
      )}

      <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 mb-4">
          <Telescope size={14} strokeWidth={2} className="text-[#0f766e]" />
          <span className="text-[14px] font-bold text-text">Árbol de Investigación</span>
          {activeNode && (
            <span className="ml-auto text-[11px] text-text-3 font-medium">
              1 investigación activa
            </span>
          )}
        </div>

        {/* Research branches grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {BRANCH_ORDER.map(branch => (
            <ResearchBranch
              key={branch}
              branch={branch}
              nodesInBranch={byBranch[branch]}
              completedSet={completedSet}
              activeNode={activeNode}
              resources={resources}
              onStart={onResearchStart}
              onCollect={onResearchCollect}
              startPending={startPending}
              collectPending={collectPending}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Base ───────────────────────────────────────────────────────────────────── */

function Base({ mainRef }) {
  const userId      = useAppStore(s => s.userId)
  const activeTab   = useAppStore(s => s.activeTab)
  const heroId      = useHeroId()
  const queryClient = useQueryClient()
  const { buildings, loading } = useBuildings(userId)
  const { resources }          = useResources(userId)
  const { rooms: trainingRooms } = useTrainingRooms(userId)
  const { rows: trainingProgress } = useTraining(heroId)
  const { potions }                        = usePotions(heroId)
  const { catalog: runesCatalog, inventory: runesInventory } = useHeroRunes(heroId)
  const { research }                       = useResearch(userId)
  const [activeZone,    setActiveZone]    = useState('inicio')
  const [resourceDelta, setResourceDelta] = useState({ iron: 0, wood: 0, mana: 0 })
  const [upgradePending, setUpgradePending] = useState(false)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  // Al volver a la Base desde otra sección, resetear siempre a Inicio
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'base') setActiveZone('inicio')
  }, [activeTab])

  // Scroll al top al cambiar de zona (igual que el cambio de tab en Dashboard)
  useEffect(() => {
    if (mainRef?.current) mainRef.current.scrollTop = 0
  }, [activeZone]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(forceUpdate, 60_000)
    return () => clearInterval(id)
  }, [])

  const craftMutation = useMutation({
    mutationFn: (potionId) => apiPost('/api/potion-craft', { heroId, potionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.potions(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      toast.success('¡Poción creada!')
    },
    onError: err => toast.error(err.message),
  })

  const runeCraftMutation = useMutation({
    mutationFn: (runeId) => apiPost('/api/rune-craft', { heroId, runeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroRunes(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      toast.success('¡Runa creada!')
    },
    onError: err => toast.error(err.message),
  })

  const researchStartMutation = useMutation({
    mutationFn: (nodeId) => apiPost('/api/research-start', { nodeId }),
    onSuccess: (_, nodeId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.research(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      const node = RESEARCH_NODES.find(n => n.id === nodeId)
      toast.success(`Investigando: ${node?.name ?? nodeId}`)
    },
    onError: err => toast.error(err.message),
  })

  const researchCollectMutation = useMutation({
    mutationFn: (nodeId) => apiPost('/api/research-collect', { nodeId }),
    onSuccess: (_, nodeId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.research(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      const node = RESEARCH_NODES.find(n => n.id === nodeId)
      toast.success(`¡${node?.name ?? nodeId} completado!`)
    },
    onError: err => toast.error(err.message),
  })

  const effectiveResources = resources
    ? { ...resources, iron: (resources.iron ?? 0) - resourceDelta.iron, wood: resources.wood - resourceDelta.wood, mana: resources.mana - resourceDelta.mana }
    : null

  function handleOptimisticDeduct({ iron = 0, wood = 0, mana = 0 }) {
    setResourceDelta(d => ({ iron: d.iron + iron, wood: d.wood + wood, mana: d.mana + mana }))
  }

  async function handleUpgradeStart() {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: queryKeys.buildings(userId) }),
      queryClient.refetchQueries({ queryKey: queryKeys.resources(userId) }),
    ])
    // Resetear delta DESPUÉS de recibir los datos frescos del servidor
    setResourceDelta({ iron: 0, wood: 0, mana: 0 })
    setUpgradePending(false)
  }

  function handleUpgradeCollect() {
    queryClient.invalidateQueries({ queryKey: queryKeys.buildings(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
  }

  if (loading) return (
    <div className="text-text-3 text-[15px] p-10 text-center">Cargando base...</div>
  )

  const byType = Object.fromEntries((buildings ?? []).map(b => [b.type, b]))
  const nexus  = byType['energy_nexus']

  const nexusData = nexus ? (() => {
    const allBuildings        = Object.values(byType)
    const produced = nexus.level * 30
    const consumed = allBuildings
      .filter(b => PRODUCTION_TYPES.includes(b.type) && b.unlocked !== false)
      .reduce((s, b) => s + b.level * 10, 0)
    const balance   = produced - consumed
    const deficit   = balance < 0
    const barPct    = consumed > 0 ? Math.min(100, Math.round((produced / consumed) * 100)) : 100
    const efficiency = consumed > 0 ? Math.min(100, Math.round((produced / consumed) * 100)) : 100
    const ratio     = consumed > 0 ? Math.min(1, produced / consumed) : 1
    return { produced, consumed, balance, deficit, barPct, efficiency, ratio }
  })() : null

  const nexusRatio   = nexusData?.ratio ?? 1
  // Solo edificios visibles bloquean las mejoras (los ocultos no se renderizan y no pueden auto-recogerse)
  const VISIBLE_BUILDINGS = ['energy_nexus', 'gold_mine', 'lumber_mill', 'mana_well', 'laboratory']
  const anyUpgrading = upgradePending || (buildings ?? []).some(
    b => VISIBLE_BUILDINGS.includes(b.type) && b.upgrade_ends_at && new Date(b.upgrade_ends_at) > new Date()
  )

  const sharedBuildingProps = {
    effectiveResources,
    anyUpgrading,
    onUpgradeStart:    handleUpgradeStart,
    onUpgradeCollect:  handleUpgradeCollect,
    onOptimisticDeduct: handleOptimisticDeduct,
    onUpgradePending:  setUpgradePending,
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <BaseHeader byType={byType} resources={effectiveResources} research={research} />

      <ZonePills active={activeZone} onChange={setActiveZone} />

      <AnimatePresence mode="wait">
        {activeZone === 'inicio' && (
          <InicioZone
            key="inicio"
            byType={byType}
            nexusData={nexusData}
            trainingRooms={trainingRooms}
            trainingProgress={trainingProgress}
            potions={potions}
            onGoTo={setActiveZone}
          />
        )}

        {activeZone === 'recursos' && (
          <RecursosZone
            key="recursos"
            byType={byType}
            nexusData={nexusData}
            nexusRatio={nexusRatio}
            {...sharedBuildingProps}
          />
        )}

        {activeZone === 'entrenamiento' && (
          <EntrenamientoZone
            key="entrenamiento"
            trainingRooms={trainingRooms}
            trainingProgress={trainingProgress}
            resources={effectiveResources}
            userId={userId}
            heroId={heroId}
            byType={byType}
          />
        )}

        {activeZone === 'laboratorio' && (
          <LaboratorioZone
            key="laboratorio"
            byType={byType}
            potions={potions}
            runesCatalog={runesCatalog}
            runesInventory={runesInventory}
            onCraft={(potionId) => craftMutation.mutate(potionId)}
            onRuneCraft={(runeId) => runeCraftMutation.mutate(runeId)}
            {...sharedBuildingProps}
          />
        )}

        {activeZone === 'biblioteca' && (
          <BibliotecaZone
            key="biblioteca"
            byType={byType}
            research={research}
            resources={effectiveResources}
            onResearchStart={(nodeId) => researchStartMutation.mutate(nodeId)}
            onResearchCollect={(nodeId) => researchCollectMutation.mutate(nodeId)}
            startPending={researchStartMutation.isPending}
            collectPending={researchCollectMutation.isPending}
            {...sharedBuildingProps}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Base
