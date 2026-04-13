import { useState, useEffect, useMemo, useReducer, useRef } from 'react'
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
import { useCraftedItems } from '../hooks/useCraftedItems'
import { interpolateHp } from '../lib/hpInterpolation'
import {
  expeditionHpCost,
  agilityDurationFactor,
  attackMultiplier as calcAttackMultiplier,
  itemDropChance,
  tacticDropChance,
  durabilityLoss as calcDurabilityLoss,
  MATERIAL_DROP_DATA,
  DUNGEON_DROP_PROFILE,
} from '../lib/gameFormulas'
import {
  Coins, Star, Clock, ChevronRight, PackageOpen, X, Sword,
  Layers, Sparkles, FlaskConical, Heart, Brain,
  Wrench, AlertTriangle, Lock, Compass, TrendingUp,
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

const FOCUS_META = {
  'Oro':          { icon: Coins,  color: '#d97706' },
  'Equipo':       { icon: Sword,  color: '#7c3aed' },
  'Tácticas':     { icon: Brain,  color: '#0891b2' },
  'Fragmentos':   { icon: Layers, color: '#b45309' },
  'Experiencia':  { icon: Star,   color: '#0369a1' },
  'Esencia':      { icon: Sparkles, color: '#7c3aed' },
  'Todo':         { icon: TrendingUp, color: '#16a34a' },
}

const EXPEDITION_POTION_EFFECTS = [
  'hp_cost_reduction', 'time_reduction', 'xp_boost', 'loot_boost', 'gold_boost',
]

const RARITY_COLORS = {
  common:    '#78716c',
  uncommon:  '#16a34a',
  rare:      '#2563eb',
  epic:      '#7c3aed',
  legendary: '#d97706',
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  Hooks                                                                     *
 * ═══════════════════════════════════════════════════════════════════════════ */

function calcRemaining(expedition) {
  if (!expedition) return 0
  return Math.max(0, Math.floor((new Date(expedition.ends_at) - Date.now()) / 1000))
}

function useExpeditionTimer(expedition) {
  const [secondsLeft, setSecondsLeft] = useState(() => calcRemaining(expedition))
  const [canCollect, setCanCollect]   = useState(
    () => !!expedition && calcRemaining(expedition) === 0 && expedition.id !== '__optimistic__'
  )

  useEffect(() => {
    if (!expedition) return
    function tick() {
      const remaining = calcRemaining(expedition)
      setSecondsLeft(remaining)
      setCanCollect(remaining === 0 && expedition.id !== '__optimistic__')
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedition?.ends_at, expedition?.id])

  const totalSeconds = expedition
    ? Math.max(1, Math.round((new Date(expedition.ends_at) - new Date(expedition.started_at)) / 1000))
    : 1
  const elapsed = totalSeconds - secondsLeft
  const pct     = canCollect ? 100 : expedition ? Math.min(99, Math.round((elapsed / totalSeconds) * 100)) : 0

  return { secondsLeft, canCollect, pct }
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

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  DifficultyDots                                                            *
 * ═══════════════════════════════════════════════════════════════════════════ */

function DifficultyDots({ value, size = 7 }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="rounded-full" style={{ width: size, height: size, background: i < value ? '#dc2626' : 'var(--border)' }} />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  ActiveExpeditionBanner — banner compacto de expedición en curso            *
 * ═══════════════════════════════════════════════════════════════════════════ */

function ActiveExpeditionBanner({ expedition, activeDungeon, onCollect }) {
  const [collecting, setCollecting] = useState(false)
  const { secondsLeft, canCollect, pct } = useExpeditionTimer(expedition)

  const dungeonName = activeDungeon?.name ?? expedition.dungeons?.name ?? 'Mazmorra'
  const dungeonType = activeDungeon?.type ?? expedition.dungeons?.type
  const typeColor   = DUNGEON_TYPE_META[dungeonType]?.color ?? '#6b7280'

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
      className="mb-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="relative flex items-center gap-3 px-4 py-3 bg-surface border rounded-xl overflow-hidden"
        style={{ borderColor: canCollect ? '#16a34a' : `color-mix(in srgb,${typeColor} 60%,var(--border))` }}
      >
        {/* Barra de progreso de fondo */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none transition-none"
          style={{ background: canCollect ? '#16a34a' : typeColor, width: `${pct}%` }}
        />

        {/* Icono estado */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb,${canCollect ? '#16a34a' : typeColor} 15%,transparent)` }}
        >
          {canCollect
            ? <PackageOpen size={16} strokeWidth={2} style={{ color: '#16a34a' }} />
            : <Compass size={16} strokeWidth={2} style={{ color: typeColor }} className="animate-[spin_8s_linear_infinite]" />
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 relative">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-text truncate">{dungeonName}</span>
            {canCollect && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#16a34a]/15 text-[#16a34a] flex-shrink-0">LISTA</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width: `${pct}%`,
                  background: canCollect ? '#16a34a' : typeColor,
                }}
              />
            </div>
            <span className="text-[11px] font-semibold text-text-3 flex-shrink-0 tabular-nums">
              {canCollect ? '100%' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
            </span>
          </div>
        </div>

        {/* Botón recoger */}
        {canCollect && (
          <motion.button
            className="px-3 py-2 rounded-lg font-bold text-[13px] text-white flex-shrink-0 relative"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
            onClick={handleCollect}
            disabled={collecting}
            whileTap={!collecting ? { scale: 0.95 } : {}}
          >
            {collecting ? '...' : 'Recoger'}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  DungeonCard — card compacta de mazmorra                                   *
 * ═══════════════════════════════════════════════════════════════════════════ */

function DungeonCard({
  dungeon, effectiveMins, hpCost, goldMin, goldMax, xpReward,
  equipChance, tacticChance, materialData, focusLabel,
  locked, busy, lowHp, isExploring,
  onStart, onDetail,
}) {
  const disabled = locked || busy || lowHp || isExploring
  const meta     = DUNGEON_TYPE_META[dungeon.type]
  const matMeta  = materialData ? MATERIAL_META[materialData.resource] : null
  const focusMeta = FOCUS_META[focusLabel]

  return (
    <div
      className={`group relative flex flex-col bg-surface border rounded-xl shadow-[var(--shadow-sm)] overflow-hidden cursor-pointer
        transition-[box-shadow,border-color] duration-200
        ${locked ? 'border-border opacity-55' : isExploring ? 'border-blue-500/50 opacity-65' : 'border-border'}`}
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
          {focusMeta && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded border"
              style={{ color: focusMeta.color, background: `color-mix(in srgb, ${focusMeta.color} 8%, var(--bg))`, borderColor: `color-mix(in srgb, ${focusMeta.color} 20%, var(--border))` }}>
              <focusMeta.icon size={9} strokeWidth={2.5} />{focusLabel}
            </span>
          )}
        </div>
      </div>

      {/* Stats compactos */}
      {!locked && (
        <div className="px-4 pt-1.5 pb-2.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-3 flex-wrap text-[13px]">
            <span className="flex items-center gap-1 text-text-2"><Clock size={13} strokeWidth={2} color="#6366f1" /><span className="font-semibold">{fmtDuration(effectiveMins)}</span></span>
            <span className="flex items-center gap-1 text-text-2"><Heart size={13} strokeWidth={2} color="#dc2626" /><span className="font-semibold">-{hpCost}</span></span>
            <span className="flex items-center gap-1 text-text-2"><Coins size={13} strokeWidth={2} color="#d97706" /><span className="font-semibold">{goldMin}–{goldMax}</span></span>
            <span className="flex items-center gap-1 text-text-2"><Star size={13} strokeWidth={2} color="#0369a1" /><span className="font-semibold">{xpReward}</span></span>
          </div>

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
            {isExploring ? <><Compass size={14} strokeWidth={2} className="animate-[spin_8s_linear_infinite]" /><span>Explorando…</span></> : busy ? 'Héroe ocupado' : lowHp ? 'HP insuficiente' : <><span>Explorar</span><ChevronRight size={15} strokeWidth={2} /></>}
          </motion.button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  DungeonDetailModal                                                        *
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
  effectiveMins, agilityPct,
  hpCost, strReduction,
  goldMin, goldMax, atkPct,
  xpReward,
  equipChance, tacticChance, intellBonus,
  durLoss, defReduction,
  materialData, equipHealth,
  disabled, disabledReason,
}) {
  const meta    = DUNGEON_TYPE_META[dungeon.type]
  const matMeta = materialData ? MATERIAL_META[materialData.resource] : null
  const profile = DUNGEON_DROP_PROFILE[dungeon.name]

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

        {/* Focus badge */}
        {profile && (() => {
          const fm = FOCUS_META[profile.focus]
          if (!fm) return null
          return (
            <div className="mx-5 mb-2 px-3 py-2 rounded-lg border flex items-center gap-2"
              style={{ background: `color-mix(in srgb, ${fm.color} 6%, var(--bg))`, borderColor: `color-mix(in srgb, ${fm.color} 20%, var(--border))` }}>
              <fm.icon size={14} strokeWidth={2.5} color={fm.color} />
              <span className="text-[12px] font-bold" style={{ color: fm.color }}>Especialidad: {profile.focus}</span>
            </div>
          )
        })()}

        {/* Stats breakdown */}
        <div className="px-5 py-3 flex flex-col divide-y divide-border">
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
 *  RewardModal — muestra TODOS los drops obtenidos                           *
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

        <div className="flex flex-col gap-3 px-5 py-4">
          {/* Gold & XP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#d97706_8%,var(--bg))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] rounded-xl px-3.5 py-3">
              <Coins size={18} color="#d97706" strokeWidth={2} />
              <div>
                <p className="text-[18px] font-bold text-text leading-none">{reward.gold}</p>
                <p className="text-[11px] text-text-3 mt-0.5">Oro</p>
                {reward.goldBonus > 0 && (
                  <p className="flex items-center gap-1 text-[10px] font-bold mt-1" style={{ color: '#d97706' }}>
                    <FlaskConical size={10} strokeWidth={2.5} />+{reward.goldBonus}
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
                    <FlaskConical size={10} strokeWidth={2.5} />+{reward.xpBonus}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Level up */}
          {reward.levelUp && (
            <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#16a34a_8%,var(--bg))] border border-[color-mix(in_srgb,#16a34a_25%,var(--border))] rounded-xl px-3.5 py-3">
              <TrendingUp size={18} color="#16a34a" strokeWidth={2} />
              <p className="text-[14px] font-bold text-[#16a34a]">¡Subida de nivel!</p>
            </div>
          )}

          {/* Material drop */}
          {reward.materialDrop && (() => {
            const mat = MATERIAL_META[reward.materialDrop.resource]
            if (!mat) return null
            const MIcon = mat.Icon
            return (
              <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border"
                style={{ background: `color-mix(in srgb, ${mat.color} 8%, var(--bg))`, borderColor: `color-mix(in srgb, ${mat.color} 25%, var(--border))` }}>
                <MIcon size={18} color={mat.color} strokeWidth={2} />
                <div>
                  <p className="text-[18px] font-bold text-text leading-none">+{reward.materialDrop.qty}</p>
                  <p className="text-[11px] text-text-3 mt-0.5">{mat.label}</p>
                </div>
              </div>
            )
          })()}

          {/* Item drop */}
          {reward.itemDrop && reward.itemDrop.item_catalog && (
            <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border"
              style={{
                background: `color-mix(in srgb, ${RARITY_COLORS[reward.itemDrop.item_catalog.rarity] ?? '#78716c'} 8%, var(--bg))`,
                borderColor: `color-mix(in srgb, ${RARITY_COLORS[reward.itemDrop.item_catalog.rarity] ?? '#78716c'} 25%, var(--border))`,
              }}>
              <Sword size={18} color={RARITY_COLORS[reward.itemDrop.item_catalog.rarity] ?? '#78716c'} strokeWidth={2} />
              <div>
                <p className="text-[14px] font-bold text-text leading-tight">{reward.itemDrop.item_catalog.name}</p>
                <p className="text-[11px] font-semibold mt-0.5"
                  style={{ color: RARITY_COLORS[reward.itemDrop.item_catalog.rarity] ?? '#78716c' }}>
                  {reward.itemDrop.item_catalog.rarity}
                </p>
              </div>
            </div>
          )}

          {/* Item drop — bag full */}
          {reward.itemDrop && reward.itemDrop.full && (
            <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border border-[color-mix(in_srgb,#dc2626_25%,var(--border))] bg-[color-mix(in_srgb,#dc2626_6%,var(--bg))]">
              <AlertTriangle size={18} color="#dc2626" strokeWidth={2} />
              <p className="text-[13px] font-semibold text-[#dc2626]">Mochila llena — equipo perdido</p>
            </div>
          )}

          {/* Tactic drop */}
          {reward.tacticDrop && reward.tacticDrop.tactic_catalog && (
            <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border border-[color-mix(in_srgb,#0891b2_25%,var(--border))] bg-[color-mix(in_srgb,#0891b2_8%,var(--bg))]">
              <Brain size={18} color="#0891b2" strokeWidth={2} />
              <div>
                <p className="text-[14px] font-bold text-text leading-tight">{reward.tacticDrop.tactic_catalog.name}</p>
                <p className="text-[11px] font-semibold mt-0.5 text-[#0891b2]">
                  {reward.tacticDrop.isNew ? 'Nueva táctica' : reward.tacticDrop.leveledUp ? `Nv. ${reward.tacticDrop.newLevel}` : reward.tacticDrop.compensated ? `+${reward.tacticDrop.goldCompensation} oro` : 'Táctica'}
                </p>
              </div>
            </div>
          )}

          {/* Tactic drop without catalog (just basic info) */}
          {reward.tacticDrop && !reward.tacticDrop.tactic_catalog && reward.tacticDrop.tactic && (
            <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border border-[color-mix(in_srgb,#0891b2_25%,var(--border))] bg-[color-mix(in_srgb,#0891b2_8%,var(--bg))]">
              <Brain size={18} color="#0891b2" strokeWidth={2} />
              <div>
                <p className="text-[14px] font-bold text-text leading-tight">{reward.tacticDrop.tactic.name}</p>
                <p className="text-[11px] font-semibold mt-0.5 text-[#0891b2]">
                  {reward.tacticDrop.isNew ? 'Nueva táctica' : reward.tacticDrop.leveledUp ? `Nv. ${reward.tacticDrop.newLevel}` : reward.tacticDrop.compensated ? `+${reward.tacticDrop.goldCompensation} oro` : 'Táctica'}
                </p>
              </div>
            </div>
          )}
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
  const { dungeons, loading: dungeonsLoading } = useDungeons()
  const { expedition, loading: expLoading, setExpedition } = useActiveExpedition(hero?.id)
  const { items }             = useInventory(heroId)
  const { inventory: craftedItems } = useCraftedItems(userId)
  const provisions            = craftedItems?.expedition_provisions ?? 0
  const equipHealth           = useEquipmentHealth(items)
  const [reward, setReward]   = useState(null)
  const [detailDungeon, setDetailDungeon] = useState(null)
  const [, forceUpdate]       = useReducer(x => x + 1, 0)
  const topRef                = useRef(null)

  // Tick cada 10s para actualizar previews
  useEffect(() => { const id = setInterval(forceUpdate, 10000); return () => clearInterval(id) }, [])

  useWakeLock(!!expedition)

  const agilityFactor  = hero ? agilityDurationFactor(hero.agility) : 1
  const atkMultiplier  = hero ? calcAttackMultiplier(hero.attack)   : 1
  const heroLevel      = hero?.level ?? 1

  // Separar mazmorras en: disponibles (por dificultad) y bloqueadas
  const { available, locked: lockedDungeons } = useMemo(() => {
    if (!dungeons) return { available: [], locked: [] }
    const avail = []
    const lock  = []
    for (const d of dungeons) {
      if (heroLevel >= d.min_hero_level) avail.push(d)
      else lock.push(d)
    }
    avail.sort((a, b) => a.difficulty - b.difficulty)
    lock.sort((a, b) => a.min_hero_level - b.min_hero_level)
    return { available: avail, locked: lock }
  }, [dungeons, heroLevel])

  // Dungeon activa
  const activeDungeon = useMemo(
    () => expedition ? dungeons?.find(d => d.id === expedition.dungeon_id) : null,
    [expedition, dungeons],
  )

  function computePreview(d) {
    const effectiveMins = Math.round(d.duration_minutes * agilityFactor)
    const agilityPct    = agilityFactor < 1 ? Math.round((1 - agilityFactor) * 100) : 0

    const profile    = DUNGEON_DROP_PROFILE[d.name] ?? {}
    const dpGold     = profile.goldMult ?? 1
    const dpXp       = profile.xpMult ?? 1
    const dpItem     = profile.itemMult ?? 1
    const dpTactic   = profile.tacticMult ?? 1

    const hpCost     = expeditionHpCost(hero?.max_hp ?? 100, d.duration_minutes, d.difficulty, hero?.strength ?? 0)
    const baseHpCost = expeditionHpCost(hero?.max_hp ?? 100, d.duration_minutes, d.difficulty, 0)
    const strReduction = baseHpCost > hpCost ? baseHpCost - hpCost : 0

    const goldMin    = Math.round(d.gold_min * atkMultiplier * dpGold)
    const goldMax    = Math.round(d.gold_max * atkMultiplier * dpGold)
    const atkPct     = atkMultiplier > 1 ? Math.round((atkMultiplier - 1) * 100) : 0
    const xpReward   = Math.round(d.experience_reward * atkMultiplier * dpXp)

    const equipChance     = itemDropChance(d.difficulty) * dpItem
    const tacticChance    = tacticDropChance(hero?.intelligence ?? 0) * dpTactic
    const baseTacticCh    = tacticDropChance(0) * dpTactic
    const intellBonus     = tacticChance > baseTacticCh ? Math.round((tacticChance - baseTacticCh) * 100) : 0

    const durLoss     = calcDurabilityLoss(d.difficulty, hero?.defense ?? 0)
    const durLossBase = calcDurabilityLoss(d.difficulty, 0)
    const defReduction = durLossBase > durLoss ? durLossBase - durLoss : 0

    const materialData = MATERIAL_DROP_DATA[d.name] ?? null

    const heroHpNow   = interpolateHp(hero, Date.now())
    const isLocked    = heroLevel < d.min_hero_level
    const busy        = (expedition ? 'exploring' : hero?.status ?? 'idle') !== 'idle'
    const lowHp       = !isLocked && !busy && (heroHpNow ?? 0) <= hpCost

    let disabledReason = null
    if (isLocked)    disabledReason = `Nv. ${d.min_hero_level} requerido`
    else if (busy)   disabledReason = 'Héroe ocupado'
    else if (lowHp)  disabledReason = 'HP insuficiente'

    return {
      effectiveMins, agilityPct,
      hpCost, strReduction,
      goldMin, goldMax, atkPct,
      xpReward,
      equipChance, tacticChance, intellBonus,
      durLoss, defReduction,
      materialData,
      focusLabel: profile.focus ?? null,
      locked: isLocked, busy, lowHp, disabled: !!disabledReason, disabledReason,
    }
  }

  async function handleStart(dungeon) {
    const now = Date.now()
    const effectiveMs = Math.round(dungeon.duration_minutes * agilityFactor) * 60_000
    setExpedition({
      id: '__optimistic__',
      dungeon_id: dungeon.id,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + effectiveMs).toISOString(),
    })
    setDetailDungeon(null)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    try {
      const data = await apiPost('/api/expedition-start', { dungeonId: dungeon.id, heroId: hero?.id })
      setExpedition(exp => exp ? { ...exp, ends_at: data.endsAt } : exp)
      if (data.provisionsUsed) {
        notify.success('Provisiones consumidas · +15% oro +10% XP')
        queryClient.invalidateQueries({ queryKey: queryKeys.craftedItems(userId) })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.activeExpedition(hero?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
    } catch (err) {
      setExpedition(null)
      notify.error(err.message)
    }
  }

  function handleCollect(data) {
    // Build reward object con todos los drops — sin notificaciones, todo va a la modal
    setReward({
      ...(data.rewards ?? {}),
      levelUp:      data.levelUp ?? false,
      materialDrop: data.materialDrop ?? null,
      itemDrop:     data.drop ?? null,
      tacticDrop:   data.tacticDrop ?? null,
    })
    triggerResourceFlash()
    setExpedition(null)
    queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.heroTactics(heroId) })
  }

  if (heroLoading || dungeonsLoading || expLoading) {
    return <div className="text-text-3 text-[15px] p-10 text-center">Cargando mazmorras...</div>
  }

  return (
    <div className="dungeons-section" ref={topRef}>
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

      {/* Provisiones */}
      {!expedition && provisions > 0 && (
        <div className="mb-3.5 flex items-center gap-2 px-3 py-2 rounded-lg border border-[color-mix(in_srgb,#0891b2_30%,var(--border))] bg-[color-mix(in_srgb,#0891b2_5%,var(--surface))]">
          <span className="text-[14px]">🎒</span>
          <span className="text-[12px] font-semibold text-[#0891b2]">
            {provisions} Provisiones disponibles — se consumirá 1 al iniciar (+15% oro, +10% XP)
          </span>
        </div>
      )}

      {/* ── Expedición activa — siempre arriba ── */}
      {expedition && (
        <ActiveExpeditionBanner
          expedition={expedition}
          activeDungeon={activeDungeon}
          onCollect={handleCollect}
        />
      )}

      {/* ── Grid de mazmorras ── */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
        variants={listVariants}
        initial="initial"
        animate="animate"
      >
        {available.map(dungeon => {
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
                focusLabel={p.focusLabel}
                locked={false}
                busy={p.busy}
                lowHp={p.lowHp}
                isExploring={expedition?.dungeon_id === dungeon.id}
                onStart={handleStart}
                onDetail={setDetailDungeon}
              />
            </motion.div>
          )
        })}
        {lockedDungeons.map(dungeon => {
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
                focusLabel={p.focusLabel}
                locked={true}
                busy={false}
                lowHp={false}
                onStart={handleStart}
                onDetail={setDetailDungeon}
              />
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

export default Dungeons
