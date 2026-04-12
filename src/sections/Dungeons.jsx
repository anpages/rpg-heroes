import { useState, useEffect, useMemo, useReducer } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { useHero } from '../hooks/useHero'
import { useDungeons } from '../hooks/useDungeons'
import { useActiveExpedition } from '../hooks/useActiveExpedition'
import { useInventory } from '../hooks/useInventory'
import { useWakeLock } from '../hooks/useWakeLock'
import { interpolateHp } from '../lib/hpInterpolation'
import {
  expeditionHpCost,
  agilityDurationFactor,
  attackMultiplier as calcAttackMultiplier,
  itemDropChance,
  tacticDropChance,
  durabilityLoss as calcDurabilityLoss,
  MATERIAL_DROP_DATA,
} from '../lib/gameFormulas'
import {
  Coins, Star, Clock, ChevronRight, PackageOpen, X, Sword, Shield,
  Layers, Sparkles, FlaskConical, Zap, Heart, Brain,
  Wrench, AlertTriangle, Lock, Compass, Info,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PotionPanel } from '../components/PotionPanel'

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  Constantes                                                                *
 * ═══════════════════════════════════════════════════════════════════════════ */

const listVariants = { animate: { transition: { staggerChildren: 0.06 } } }
const cardVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
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
function fmtPct(n) { return `${Math.round(n * 100)}%` }
function fmtDuration(mins) {
  if (mins >= 60) { const h = Math.floor(mins / 60), m = mins % 60; return m > 0 ? `${h}h ${m}m` : `${h}h` }
  return `${mins}m`
}

const DUNGEON_TYPE_META = {
  combat:     { label: 'Combate',    color: '#dc2626', loot: 'Armas y escudos'              },
  wilderness: { label: 'Naturaleza', color: '#16a34a', loot: 'Armadura ligera y accesorios'  },
  magic:      { label: 'Arcana',     color: '#7c3aed', loot: 'Accesorios mágicos'            },
  crypt:      { label: 'Cripta',     color: '#475569', loot: 'Escudos y armadura pesada'      },
  mine:       { label: 'Mina',       color: '#b45309', loot: 'Armas y armadura de brazos'     },
  ancient:    { label: 'Antigua',    color: '#0369a1', loot: 'Accesorios y yelmos antiguos'   },
}
const MATERIAL_META = {
  fragments: { label: 'Fragmentos', Icon: Layers,   color: '#b45309' },
  essence:   { label: 'Esencia',    Icon: Sparkles, color: '#7c3aed' },
}

const WEAPON_TYPES  = ['combat', 'mine']
const ARMOR_TYPES   = ['wilderness', 'magic', 'crypt', 'ancient']

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  Filtros                                                                   *
 * ═══════════════════════════════════════════════════════════════════════════ */

const FILTERS = [
  { id: 'active',    label: 'En curso',    icon: Compass  },
  { id: 'weapons',   label: 'Armas',       icon: Sword    },
  { id: 'armor',     label: 'Armaduras',   icon: Shield   },
  { id: 'tactics',   label: 'Tácticas',    icon: Brain    },
  { id: 'fragments', label: 'Fragmentos',  icon: Layers   },
  { id: 'essence',   label: 'Esencia',     icon: Sparkles },
  { id: 'quick',     label: 'Rápidas',     icon: Zap      },
]

function filterDungeons(dungeons, filter, heroLevel) {
  if (!dungeons) return []
  const available = dungeons.filter(d => heroLevel >= d.min_hero_level)

  switch (filter) {
    case 'weapons':
      return available.filter(d => WEAPON_TYPES.includes(d.type)).sort((a, b) => a.difficulty - b.difficulty)
    case 'armor':
      return available.filter(d => ARMOR_TYPES.includes(d.type)).sort((a, b) => a.difficulty - b.difficulty)
    case 'tactics':
      return available.slice().sort((a, b) => b.difficulty - a.difficulty)
    case 'fragments':
      return available.filter(d => MATERIAL_DROP_DATA[d.name]?.resource === 'fragments').sort((a, b) => (MATERIAL_DROP_DATA[b.name]?.chance ?? 0) - (MATERIAL_DROP_DATA[a.name]?.chance ?? 0))
    case 'essence':
      return available.filter(d => MATERIAL_DROP_DATA[d.name]?.resource === 'essence').sort((a, b) => (MATERIAL_DROP_DATA[b.name]?.chance ?? 0) - (MATERIAL_DROP_DATA[a.name]?.chance ?? 0))
    case 'quick':
      return available.filter(d => d.duration_minutes <= 20).sort((a, b) => a.duration_minutes - b.duration_minutes)
    case 'locked':
      return dungeons.filter(d => heroLevel < d.min_hero_level).sort((a, b) => a.min_hero_level - b.min_hero_level)
    default:
      return available.slice().sort((a, b) => a.difficulty - b.difficulty)
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  Hooks                                                                     *
 * ═══════════════════════════════════════════════════════════════════════════ */

function useExpeditionTimer(expedition) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [canCollect, setCanCollect]   = useState(false)
  const [isMounted,  setIsMounted]    = useState(false)

  useEffect(() => {
    if (!expedition) return
    function tick() {
      const remaining = Math.max(0, Math.floor((new Date(expedition.ends_at) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      setCanCollect(remaining === 0 && expedition.id !== '__optimistic__')
    }
    tick()
    requestAnimationFrame(() => setIsMounted(true))
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedition?.ends_at, expedition?.id])

  const totalSeconds = expedition
    ? Math.max(1, Math.round((new Date(expedition.ends_at) - new Date(expedition.started_at)) / 1000))
    : 1
  const elapsed = totalSeconds - (secondsLeft ?? totalSeconds)
  const pct     = expedition ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0

  return { secondsLeft, canCollect, isMounted, pct }
}

function useEquipmentHealth(items) {
  return useMemo(() => {
    if (!items) return { avgDurPct: 1, hasDamagedGear: false, equippedCount: 0 }
    const equipped = items.filter(i => i.equipped_slot)
    if (equipped.length === 0) return { avgDurPct: 1, hasDamagedGear: false, equippedCount: 0 }
    const total = equipped.reduce((sum, i) => {
      const max = i.item_catalog?.max_durability ?? 1
      return sum + (max > 0 ? i.current_durability / max : 1)
    }, 0)
    const avg = total / equipped.length
    return { avgDurPct: avg, hasDamagedGear: avg < 0.5, equippedCount: equipped.length }
  }, [items])
}

const EXPEDITION_POTION_EFFECTS = [
  'time_reduction', 'xp_boost', 'loot_boost', 'gold_boost', 'card_guaranteed',
]

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  DifficultyDots                                                            *
 * ═══════════════════════════════════════════════════════════════════════════ */

function DifficultyDots({ value, size = 7 }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="rounded-full" style={{ width: size, height: size, background: i < value ? '#dc2626' : 'var(--border)' }} />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  DungeonCard — versión compacta                                            *
 *  Muestra solo lo esencial: tiempo, coste HP, recompensas.                  *
 *  Tap en la card abre DungeonDetailModal para ver todo el desglose.         *
 * ═══════════════════════════════════════════════════════════════════════════ */

function DungeonCard({
  dungeon, effectiveMins, hpCost, goldMin, goldMax, xpReward,
  equipChance, tacticChance, materialData,
  isWeekly, weeklyMeta, isShort, locked, busy, lowHp,
  onStart, onDetail,
}) {
  const disabled = locked || busy || lowHp
  const meta     = DUNGEON_TYPE_META[dungeon.type]
  const matMeta  = materialData ? MATERIAL_META[materialData.resource] : null

  return (
    <div
      className={`group relative flex flex-col bg-surface border rounded-xl shadow-[var(--shadow-sm)] overflow-hidden cursor-pointer
        transition-[box-shadow,border-color] duration-200
        ${locked ? 'border-border opacity-55' : 'border-border hover:shadow-[var(--shadow-md)] hover:border-border-2'}`}
      style={isWeekly && weeklyMeta && !locked ? {
        borderColor: `color-mix(in srgb, ${weeklyMeta.color} 50%, var(--border))`,
        boxShadow:   `0 0 0 1px color-mix(in srgb, ${weeklyMeta.color} 25%, transparent), var(--shadow-sm)`,
        background:  `color-mix(in srgb, ${weeklyMeta.color} 3%, var(--surface))`,
      } : undefined}
      onClick={() => !locked && onDetail(dungeon)}
    >
      {/* Accent bar — type color */}
      {meta && <div className="h-[3px] w-full" style={{ background: meta.color }} />}

      {/* Header */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-[15px] font-bold text-text leading-tight">{dungeon.name}</h3>
          <DifficultyDots value={dungeon.difficulty} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {meta && <span className="text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: meta.color }}>{meta.label}</span>}
          {isShort && (
            <span className="text-[10px] font-bold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,#16a34a_10%,var(--bg))] text-[#16a34a] border border-[color-mix(in_srgb,#16a34a_20%,var(--border))]">
              Rápida
            </span>
          )}
          {isWeekly && weeklyMeta && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded border"
              style={{ color: weeklyMeta.color, background: `color-mix(in srgb, ${weeklyMeta.color} 10%, var(--bg))`, borderColor: `color-mix(in srgb, ${weeklyMeta.color} 25%, var(--border))` }}>
              <Zap size={9} strokeWidth={2.5} />{weeklyMeta.name}
            </span>
          )}
        </div>
      </div>

      {/* Stats compactos — 2 filas */}
      {!locked && (
        <div className="px-4 pt-1.5 pb-2.5 flex flex-col gap-1.5">
          {/* Fila 1: costes y recompensas base */}
          <div className="flex items-center gap-3 flex-wrap text-[13px]">
            <span className="flex items-center gap-1 text-text-2"><Clock size={13} strokeWidth={2} color="#6366f1" /><span className="font-semibold">{fmtDuration(effectiveMins)}</span></span>
            <span className="flex items-center gap-1 text-text-2"><Heart size={13} strokeWidth={2} color="#dc2626" /><span className="font-semibold">-{hpCost}</span></span>
            <span className="flex items-center gap-1 text-text-2"><Coins size={13} strokeWidth={2} color="#d97706" /><span className="font-semibold">{goldMin}–{goldMax}</span></span>
            <span className="flex items-center gap-1 text-text-2"><Star size={13} strokeWidth={2} color="#0369a1" /><span className="font-semibold">{xpReward}</span></span>
          </div>

          {/* Fila 2: drop chances */}
          <div className="flex items-center gap-3 text-[12px] text-text-3">
            <span className="flex items-center gap-1"><Sword size={12} strokeWidth={2} color="#7c3aed" />{fmtPct(equipChance)}</span>
            <span className="flex items-center gap-1"><Brain size={12} strokeWidth={2} color="#0891b2" />{fmtPct(tacticChance)}</span>
            {materialData && matMeta && (
              <span className="flex items-center gap-1" style={{ color: matMeta.color }}>
                <matMeta.Icon size={12} strokeWidth={2} />{fmtPct(materialData.chance)} <span className="text-text-3">×{materialData.min}–{materialData.max}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Locked: info mínima */}
      {locked && meta && (
        <div className="px-4 pb-3 pt-1 flex items-center gap-2">
          <span className="text-[12px] font-semibold text-text-3">
            <Lock size={11} strokeWidth={2.5} className="inline mr-1" />Nv. {dungeon.min_hero_level}+
          </span>
          <span className="text-[12px] font-semibold opacity-70" style={{ color: meta.color }}>{meta.loot}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end px-4 py-2.5 border-t border-border mt-auto">
        {locked ? (
          <span className="text-[13px] font-semibold text-text-3">Nv. {dungeon.min_hero_level} requerido</span>
        ) : (
          <motion.button
            className="btn btn--primary flex-shrink-0"
            onClick={e => { e.stopPropagation(); onStart(dungeon) }}
            disabled={disabled}
            whileTap={disabled ? {} : { scale: 0.96 }}
          >
            {busy ? 'Héroe ocupado' : lowHp ? 'HP insuficiente' : <><span>Explorar</span><ChevronRight size={15} strokeWidth={2} /></>}
          </motion.button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  ActiveExpeditionView — vista "En curso"                                   *
 *  Card prominente con progreso, timer y botón de recolección.               *
 * ═══════════════════════════════════════════════════════════════════════════ */

function ActiveExpeditionView({ expedition, activeDungeon, onCollect, weeklyModifier }) {
  const [collecting, setCollecting] = useState(false)
  const timer = useExpeditionTimer(expedition)

  if (!expedition) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Compass size={40} strokeWidth={1.5} className="text-text-3 mb-3 opacity-40" />
        <p className="text-[15px] font-semibold text-text-2 mb-1">Sin expediciones en curso</p>
        <p className="text-[13px] text-text-3">Elige una mazmorra en las otras pestañas para empezar a explorar.</p>
      </div>
    )
  }

  const meta      = activeDungeon ? DUNGEON_TYPE_META[activeDungeon.type] : null
  const isWeekly  = weeklyModifier?.dungeon_id === expedition.dungeon_id
  const weekMeta  = isWeekly ? weeklyModifier?.modifier : null
  const accentColor = timer.canCollect ? '#16a34a' : 'var(--blue-500)'

  async function handleCollect() {
    setCollecting(true)
    try {
      const data = await apiPost('/api/expedition-collect', { expeditionId: expedition.id })
      onCollect(data)
    } catch (err) {
      notify.error(err.message)
    }
    setCollecting(false)
  }

  return (
    <motion.div
      className="max-w-md mx-auto w-full"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className="relative flex flex-col bg-surface border-2 rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden"
        style={{
          borderColor: accentColor,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${accentColor} 20%, transparent), 0 8px 32px -8px color-mix(in srgb, ${accentColor} 20%, transparent)`,
        }}
      >
        {/* Status banner */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {timer.canCollect ? (
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#16a34a]">
                <PackageOpen size={15} strokeWidth={2} />
                ¡Expedición lista!
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--blue-500)]">
                <Compass size={15} strokeWidth={2} className="animate-[spin_8s_linear_infinite]" />
                Explorando...
              </span>
            )}
          </div>
          {isWeekly && weekMeta && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded border"
              style={{ color: weekMeta.color, background: `color-mix(in srgb, ${weekMeta.color} 10%, var(--bg))`, borderColor: `color-mix(in srgb, ${weekMeta.color} 25%, var(--border))` }}>
              <Zap size={9} strokeWidth={2.5} />{weekMeta.name}
            </span>
          )}
        </div>

        {/* Dungeon name */}
        <div className="px-5 pb-3">
          <h3 className="text-[18px] font-bold text-text">{activeDungeon?.name ?? expedition.dungeons?.name ?? 'Mazmorra'}</h3>
          {meta && (
            <span className="text-[12px] font-bold uppercase tracking-[0.05em]" style={{ color: meta.color }}>{meta.label}</span>
          )}
        </div>

        {/* Progress */}
        <div className="px-5 pb-4">
          <div className="h-3 bg-surface-2 rounded-full overflow-hidden border border-border">
            <motion.div
              className="h-full rounded-full"
              style={{ background: accentColor }}
              initial={false}
              animate={{ width: `${timer.pct}%` }}
              transition={{ duration: timer.isMounted ? 1 : 0, ease: 'linear' }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[13px] font-semibold text-text-3">{timer.pct}%</span>
            <span className={`text-[14px] font-bold ${timer.canCollect ? 'text-[#16a34a]' : 'text-text-2'}`}>
              {timer.canCollect ? 'Completada' : timer.secondsLeft !== null ? fmtTime(timer.secondsLeft) : '...'}
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="px-5 pb-5">
          <motion.button
            className={`w-full py-3 rounded-xl font-bold text-[15px] border-0 text-white transition-opacity ${timer.canCollect ? '' : 'opacity-40 cursor-not-allowed'}`}
            style={{ background: timer.canCollect ? 'linear-gradient(135deg, #16a34a, #15803d)' : 'var(--surface-3)' }}
            onClick={handleCollect}
            disabled={!timer.canCollect || collecting}
            whileTap={timer.canCollect && !collecting ? { scale: 0.97 } : {}}
          >
            <span className="flex items-center justify-center gap-2">
              <PackageOpen size={17} strokeWidth={2} />
              {collecting ? 'Recogiendo...' : timer.canCollect ? 'Recoger recompensas' : 'En progreso...'}
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  ReadyBanner — banner sutil cuando hay expedición lista y no estás        *
 *  en la pestaña "En curso". Click → te lleva allí.                          *
 * ═══════════════════════════════════════════════════════════════════════════ */

function ReadyBanner({ onSwitch }) {
  return (
    <motion.button
      className="w-full flex items-center gap-2 px-4 py-2.5 mb-3 rounded-xl border-2 border-[#16a34a] text-left cursor-pointer
        bg-[color-mix(in_srgb,#16a34a_6%,var(--surface))]"
      onClick={onSwitch}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileTap={{ scale: 0.98 }}
    >
      <PackageOpen size={18} strokeWidth={2} color="#16a34a" />
      <span className="flex-1 text-[14px] font-bold text-[#16a34a]">¡Tu expedición está lista!</span>
      <ChevronRight size={16} strokeWidth={2.5} color="#16a34a" />
    </motion.button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  DungeonDetailModal — desglose completo al pulsar una card                 *
 * ═══════════════════════════════════════════════════════════════════════════ */

function DetailRow({ icon: Icon, iconColor, label, value, bonus, bonusColor, warning }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={15} strokeWidth={2} color={iconColor} className="flex-shrink-0" />
        <span className="text-[13px] font-semibold text-text-2">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[14px] font-bold text-text">{value}</span>
        {bonus && <span className="text-[11px] font-bold" style={{ color: bonusColor ?? '#16a34a' }}>{bonus}</span>}
        {warning && (
          <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#dc2626]">
            <AlertTriangle size={10} strokeWidth={2.5} />{warning}
          </span>
        )}
      </div>
    </div>
  )
}

function DungeonDetailModal({
  dungeon, onClose, onStart,
  effectiveMins, baseMins, agilityPct,
  hpCost, baseHpCost, strReduction,
  goldMin, goldMax, baseGoldMin, baseGoldMax, atkPct,
  xpReward, baseXp,
  equipChance, tacticChance, baseTacticChance, intellBonus,
  durLoss, durLossBase, defReduction,
  materialData, isWeekly, weeklyMeta, equipHealth,
  disabled, disabledReason,
}) {
  const meta    = DUNGEON_TYPE_META[dungeon.type]
  const matMeta = materialData ? MATERIAL_META[materialData.resource] : null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <motion.div
        className="relative bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-lg)] w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-bold text-text">{dungeon.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {meta && <span className="text-[12px] font-bold uppercase tracking-[0.05em]" style={{ color: meta.color }}>{meta.label}</span>}
              <DifficultyDots value={dungeon.difficulty} size={6} />
            </div>
          </div>
          <button className="btn btn--ghost btn--icon flex-shrink-0" onClick={onClose} aria-label="Cerrar"><X size={16} strokeWidth={2} /></button>
        </div>

        {/* Description */}
        <div className="px-5 pt-3 pb-2">
          <p className="text-[13px] text-text-3 leading-[1.5]">{dungeon.description}</p>
        </div>

        {/* Weekly badge */}
        {isWeekly && weeklyMeta && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-lg border flex items-center gap-2"
            style={{ background: `color-mix(in srgb, ${weeklyMeta.color} 6%, var(--bg))`, borderColor: `color-mix(in srgb, ${weeklyMeta.color} 30%, var(--border))` }}>
            <Zap size={14} strokeWidth={2.5} color={weeklyMeta.color} />
            <div>
              <span className="text-[12px] font-bold" style={{ color: weeklyMeta.color }}>{weeklyMeta.name}</span>
              <p className="text-[11px] text-text-3">{weeklyMeta.description}</p>
            </div>
          </div>
        )}

        {/* Stats breakdown */}
        <div className="px-5 py-3 flex flex-col divide-y divide-border">
          {/* Costes */}
          <div className="pb-2">
            <p className="text-[11px] font-bold text-text-3 uppercase tracking-[0.08em] mb-1">Costes</p>
            <DetailRow icon={Clock} iconColor="#6366f1" label="Duración" value={fmtDuration(effectiveMins)}
              bonus={agilityPct > 0 ? `−${agilityPct}% Agi` : null} />
            <DetailRow icon={Heart} iconColor="#dc2626" label="Vida" value={`-${hpCost} HP`}
              bonus={strReduction > 0 ? `−${strReduction} Fza` : null} />
            {durLoss > 0 && (
              <DetailRow icon={Wrench} iconColor="#78716c" label="Desgaste" value={`${durLoss} pts`}
                bonus={defReduction > 0 ? `−${defReduction} Def` : null}
                warning={equipHealth?.hasDamagedGear ? 'Dañado' : null} />
            )}
          </div>

          {/* Recompensas */}
          <div className="pt-2">
            <p className="text-[11px] font-bold text-text-3 uppercase tracking-[0.08em] mb-1">Recompensas</p>
            <DetailRow icon={Coins} iconColor="#d97706" label="Oro" value={`${goldMin}–${goldMax}`}
              bonus={atkPct > 0 ? `+${atkPct}% Atq` : null} bonusColor="#d97706" />
            <DetailRow icon={Star} iconColor="#0369a1" label="Experiencia" value={`${xpReward} XP`}
              bonus={atkPct > 0 ? `+${atkPct}% Atq` : null} bonusColor="#0369a1" />
            <DetailRow icon={Sword} iconColor="#7c3aed" label="Equipo" value={fmtPct(equipChance)} />
            <DetailRow icon={Brain} iconColor="#0891b2" label="Táctica" value={fmtPct(tacticChance)}
              bonus={intellBonus > 0 ? `+${intellBonus}% Int` : null} bonusColor="#0891b2" />
            {materialData && matMeta && (
              <DetailRow icon={matMeta.Icon} iconColor={matMeta.color} label={matMeta.label}
                value={`${fmtPct(materialData.chance)} (×${materialData.min}–${materialData.max})`} />
            )}
          </div>
        </div>

        {/* Loot types */}
        {meta && (
          <div className="px-5 pb-3">
            <p className="text-[12px] text-text-3"><span className="font-semibold" style={{ color: meta.color }}>Loot:</span> {meta.loot}</p>
          </div>
        )}

        {/* Action */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-4">
          <motion.button
            className="btn btn--primary btn--full"
            onClick={() => { onStart(dungeon); onClose() }}
            disabled={disabled}
            whileTap={disabled ? {} : { scale: 0.97 }}
          >
            {disabledReason ?? <><span>Explorar</span><ChevronRight size={15} strokeWidth={2} /></>}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  RewardModal — sin cambios                                                 *
 * ═══════════════════════════════════════════════════════════════════════════ */

function RewardModal({ reward, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <motion.div
        className="relative bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-sm overflow-hidden"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <div>
            <p className="text-[17px] font-bold text-text">¡Expedición completada!</p>
            <p className="text-[13px] text-text-3 mt-0.5">Has vuelto con recompensas</p>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Cerrar"><X size={16} strokeWidth={2} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#d97706_8%,var(--bg))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] rounded-xl px-3.5 py-3">
            <Coins size={18} color="#d97706" strokeWidth={2} />
            <div>
              <p className="text-[18px] font-bold text-text leading-none">{reward.gold}</p>
              <p className="text-[11px] text-text-3 mt-0.5">Oro</p>
              {reward.goldBonus > 0 && (
                <p className="flex items-center gap-1 text-[10px] font-bold mt-1" style={{ color: '#d97706' }}>
                  <FlaskConical size={10} strokeWidth={2.5} />+{reward.goldBonus} poción
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#0369a1_8%,var(--bg))] border border-[color-mix(in_srgb,#0369a1_25%,var(--border))] rounded-xl px-3.5 py-3">
            <Star size={18} color="#0369a1" strokeWidth={2} />
            <div>
              <p className="text-[18px] font-bold text-text leading-none">{reward.experience}</p>
              <p className="text-[11px] text-text-3 mt-0.5">XP</p>
              {reward.xpBonus > 0 && (
                <p className="flex items-center gap-1 text-[10px] font-bold mt-1" style={{ color: '#0369a1' }}>
                  <FlaskConical size={10} strokeWidth={2.5} />+{reward.xpBonus} poción
                </p>
              )}
            </div>
          </div>
          {reward.materialDrop && (() => {
            const mat = MATERIAL_META[reward.materialDrop.resource]
            if (!mat) return null
            const MIcon = mat.Icon
            return (
              <div className="col-span-2 flex items-center gap-2.5 rounded-xl px-3.5 py-3 border"
                style={{ background: `color-mix(in srgb, ${mat.color} 8%, var(--bg))`, borderColor: `color-mix(in srgb, ${mat.color} 25%, var(--border))` }}>
                <MIcon size={18} color={mat.color} strokeWidth={2} />
                <div>
                  <p className="text-[18px] font-bold text-text leading-none">+{reward.materialDrop.qty}</p>
                  <p className="text-[11px] text-text-3 mt-0.5">{mat.label}</p>
                </div>
              </div>
            )
          })()}
        </div>
        <div className="px-5 pb-5">
          <button className="btn btn--primary btn--full" onClick={onClose}>Continuar</button>
        </div>
      </motion.div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  Dungeons — componente principal                                           *
 * ═══════════════════════════════════════════════════════════════════════════ */

function Dungeons() {
  const userId                = useAppStore(s => s.userId)
  const triggerResourceFlash  = useAppStore(s => s.triggerResourceFlash)
  const heroId                = useHeroId()
  const queryClient           = useQueryClient()
  const { hero, loading: heroLoading }       = useHero(heroId)
  const { dungeons, loading: dungeonsLoading, weeklyModifier, weeklyLoading } = useDungeons(heroId)
  const { expedition, loading: expLoading, setExpedition } = useActiveExpedition(hero?.id)
  const { items }             = useInventory(heroId)
  const equipHealth           = useEquipmentHealth(items)
  const [reward, setReward]   = useState(null)
  const [filter, setFilter]   = useState(null) // null = pendiente de inicializar
  const [detailDungeon, setDetailDungeon] = useState(null)
  const [, forceUpdate]       = useReducer(x => x + 1, 0)

  // Tick cada 10s para actualizar timers
  useEffect(() => { const id = setInterval(forceUpdate, 10000); return () => clearInterval(id) }, [])

  useWakeLock(!!expedition)

  // Auto-seleccionar filtro al montar: "En curso" si hay expedición, si no "Armas"
  useEffect(() => {
    if (filter !== null) return
    setFilter(expedition ? 'active' : 'weapons')
  }, [expedition, filter])

  const agilityFactor  = hero ? agilityDurationFactor(hero.agility) : 1
  const atkMultiplier  = hero ? calcAttackMultiplier(hero.attack)   : 1
  const heroLevel      = hero?.level ?? 1

  const filtered = useMemo(
    () => filterDungeons(dungeons, filter, heroLevel),
    [dungeons, filter, heroLevel],
  )

  const lockedCount = useMemo(
    () => (dungeons ?? []).filter(d => heroLevel < d.min_hero_level).length,
    [dungeons, heroLevel],
  )

  // Timer para saber si la expedición está lista (para badge y banner)
  const expeditionTimer = useExpeditionTimer(expedition ?? null)
  const expeditionReady = expeditionTimer.canCollect

  // Dungeon activa (para ActiveExpeditionView)
  const activeDungeon = useMemo(
    () => expedition ? dungeons?.find(d => d.id === expedition.dungeon_id) : null,
    [expedition, dungeons],
  )

  // Helpers de stat por mazmorra
  function computePreview(d) {
    const isWeekly   = weeklyModifier?.dungeon_id === d.id
    const weekMeta   = isWeekly ? weeklyModifier?.modifier : null
    const durMult    = isWeekly && weekMeta?.durationMult ? weekMeta.durationMult : 1
    const effectiveMins = Math.round(d.duration_minutes * agilityFactor * durMult)
    const baseMins      = d.duration_minutes
    const agilityPct    = agilityFactor < 1 ? Math.round((1 - agilityFactor) * 100) : 0

    const hpCost     = expeditionHpCost(hero?.max_hp ?? 100, d.duration_minutes, d.difficulty, hero?.strength ?? 0)
    const baseHpCost = expeditionHpCost(hero?.max_hp ?? 100, d.duration_minutes, d.difficulty, 0)
    const strReduction = baseHpCost > hpCost ? baseHpCost - hpCost : 0

    const goldMin    = Math.round(d.gold_min * atkMultiplier)
    const goldMax    = Math.round(d.gold_max * atkMultiplier)
    const atkPct     = atkMultiplier > 1 ? Math.round((atkMultiplier - 1) * 100) : 0
    const xpReward   = Math.round(d.experience_reward * atkMultiplier)

    const equipChance     = itemDropChance(d.difficulty)
    const tacticChance    = tacticDropChance(hero?.intelligence ?? 0)
    const baseTacticCh    = tacticDropChance(0)
    const intellBonus     = tacticChance > baseTacticCh ? Math.round((tacticChance - baseTacticCh) * 100) : 0

    const durLoss     = calcDurabilityLoss(d.difficulty, hero?.defense ?? 0)
    const durLossBase = calcDurabilityLoss(d.difficulty, 0)
    const defReduction = durLossBase > durLoss ? durLossBase - durLoss : 0

    const materialData = MATERIAL_DROP_DATA[d.name] ?? null

    const heroHpNow   = interpolateHp(hero, Date.now())
    const locked      = heroLevel < d.min_hero_level
    const busy        = (expedition ? 'exploring' : hero?.status ?? 'idle') !== 'idle'
    const lowHp       = !locked && !busy && (heroHpNow ?? 0) <= hpCost

    let disabledReason = null
    if (locked)   disabledReason = `Nv. ${d.min_hero_level} requerido`
    else if (busy) disabledReason = 'Héroe ocupado'
    else if (lowHp) disabledReason = 'HP insuficiente'

    return {
      effectiveMins, baseMins, agilityPct,
      hpCost, baseHpCost, strReduction,
      goldMin, goldMax, baseGoldMin: d.gold_min, baseGoldMax: d.gold_max, atkPct,
      xpReward, baseXp: d.experience_reward,
      equipChance, tacticChance, baseTacticChance: baseTacticCh, intellBonus,
      durLoss, durLossBase, defReduction,
      materialData, isWeekly, weeklyMeta: weekMeta,
      isShort: d.duration_minutes <= 20,
      locked, busy, lowHp, disabled: !!disabledReason, disabledReason,
    }
  }

  async function handleStart(dungeon) {
    const now = Date.now()
    const isWeekly = weeklyModifier?.dungeon_id === dungeon.id
    const durMult  = isWeekly && weeklyModifier?.modifier?.durationMult ? weeklyModifier.modifier.durationMult : 1
    const effectiveMs = Math.round(dungeon.duration_minutes * agilityFactor * durMult) * 60_000
    setExpedition({
      id: '__optimistic__',
      dungeon_id: dungeon.id,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + effectiveMs).toISOString(),
    })
    setFilter('active')
    setDetailDungeon(null)

    try {
      const data = await apiPost('/api/expedition-start', { dungeonId: dungeon.id, heroId: hero?.id })
      setExpedition(exp => exp ? { ...exp, ends_at: data.endsAt } : exp)
      queryClient.invalidateQueries({ queryKey: queryKeys.activeExpedition(hero?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
    } catch (err) {
      setExpedition(null)
      setFilter('weapons')
      notify.error(err.message)
    }
  }

  function handleCollect(data) {
    setReward({ ...(data.rewards ?? {}), materialDrop: data.materialDrop ?? null })
    if (data.drop?.item_catalog)        notify.itemDrop(data.drop.item_catalog)
    if (data.drop?.full)                notify.bagFull()
    if (data.tacticDrop?.tactic_catalog) notify.tacticDrop(data.tacticDrop.tactic_catalog)
    triggerResourceFlash()
    setExpedition(null)
    setFilter('weapons')
    queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.heroTactics(heroId) })
  }

  if (heroLoading || dungeonsLoading || expLoading || weeklyLoading) {
    return <div className="text-text-3 text-[15px] p-10 text-center">Cargando mazmorras...</div>
  }

  const heroStatus = expedition ? 'exploring' : (hero?.status ?? 'idle')

  return (
    <div className="dungeons-section">
      {/* Reward modal */}
      {reward && createPortal(
        <RewardModal reward={reward} onClose={() => setReward(null)} />,
        document.body
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {detailDungeon && (() => {
          const p = computePreview(detailDungeon)
          return createPortal(
            <DungeonDetailModal
              dungeon={detailDungeon}
              onClose={() => setDetailDungeon(null)}
              onStart={handleStart}
              equipHealth={equipHealth}
              {...p}
            />,
            document.body
          )
        })()}
      </AnimatePresence>

      {/* Pociones pre-expedición */}
      {filter !== 'active' && (
        <div className="mb-3.5">
          <PotionPanel
            heroId={heroId}
            userId={userId}
            activeEffects={hero?.active_effects}
            effectTypes={EXPEDITION_POTION_EFFECTS}
            title="Pociones de expedición"
            isExploring={heroStatus === 'exploring'}
          />
        </div>
      )}

      {/* Ready banner — cuando no estás en "En curso" pero hay expedición lista */}
      {filter !== 'active' && expedition && expeditionReady && (
        <ReadyBanner onSwitch={() => setFilter('active')} />
      )}

      {/* Filter bar */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        {[...FILTERS, ...(lockedCount > 0 ? [{ id: 'locked', label: 'Bloqueadas', icon: Lock }] : [])].map(f => {
          const active = filter === f.id
          const FIcon  = f.icon
          const isActiveFilter = f.id === 'active'
          // Badge indicador en "En curso"
          const hasExpedition = isActiveFilter && !!expedition
          const dotColor = hasExpedition ? (expeditionReady ? '#16a34a' : 'var(--blue-500)') : null

          return (
            <button
              key={f.id}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap border transition-colors
                ${active
                  ? 'bg-[color-mix(in_srgb,var(--blue-500)_12%,var(--surface))] border-[var(--blue-300)] text-[var(--blue-600)]'
                  : 'bg-surface border-border text-text-3 hover:text-text-2 hover:border-border-2'
                }`}
              onClick={() => setFilter(f.id)}
            >
              <FIcon size={14} strokeWidth={2} />
              {f.label}
              {f.id === 'locked' && <span className="text-[11px] bg-text-3/15 text-text-3 rounded-full px-1.5 py-0 font-bold leading-[18px]">{lockedCount}</span>}
              {dotColor && !active && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface animate-pulse" style={{ background: dotColor }} />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Vista "En curso" ── */}
      {filter === 'active' && (
        <ActiveExpeditionView
          expedition={expedition}
          activeDungeon={activeDungeon}
          onCollect={handleCollect}
          weeklyModifier={weeklyModifier}
        />
      )}

      {/* ── Vista normal: grid de mazmorras ── */}
      {filter !== 'active' && (
        <>
          {filtered.length === 0 && (
            <div className="text-text-3 text-[14px] p-8 text-center">
              {filter === 'fragments' ? 'No hay mazmorras de fragmentos para tu nivel.'
                : filter === 'essence' ? 'No hay mazmorras de esencia para tu nivel.'
                : filter === 'quick' ? 'No hay expediciones rápidas disponibles.'
                : filter === 'locked' ? 'Todas las mazmorras están desbloqueadas.'
                : 'No se encontraron mazmorras.'}
            </div>
          )}

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
            variants={listVariants}
            initial="initial"
            animate="animate"
            key={filter}
          >
            {filtered.map(dungeon => {
              const p = computePreview(dungeon)
              return (
                <motion.div key={dungeon.id} variants={cardVariants}>
                  <DungeonCard
                    dungeon={dungeon}
                    effectiveMins={p.effectiveMins}
                    hpCost={p.hpCost}
                    goldMin={p.goldMin}
                    goldMax={p.goldMax}
                    xpReward={p.xpReward}
                    equipChance={p.equipChance}
                    tacticChance={p.tacticChance}
                    materialData={p.materialData}
                    isWeekly={p.isWeekly}
                    weeklyMeta={p.weeklyMeta}
                    isShort={p.isShort}
                    locked={p.locked}
                    busy={p.busy}
                    lowHp={p.lowHp}
                    onStart={handleStart}
                    onDetail={setDetailDungeon}
                  />
                </motion.div>
              )
            })}
          </motion.div>
        </>
      )}
    </div>
  )
}

export default Dungeons
