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
  DUNGEON_TYPE_SLOTS,
} from '../lib/gameFormulas'
import {
  Coins, Star, Clock, ChevronRight, PackageOpen, X, Sword,
  Layers, Sparkles, FlaskConical, Heart, Brain,
  Wrench, AlertTriangle, Lock, Compass, TrendingUp,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  combat:     { label: 'Combate',    color: '#dc2626' },
  wilderness: { label: 'Naturaleza', color: '#16a34a' },
  magic:      { label: 'Arcana',     color: '#7c3aed' },
  crypt:      { label: 'Cripta',     color: '#475569' },
  mine:       { label: 'Mina',       color: '#b45309' },
  ancient:    { label: 'Antigua',    color: '#0369a1' },
}

const MATERIAL_META = {
  fragments: { label: 'Fragmentos', Icon: Layers,   color: '#b45309' },
  essence:   { label: 'Esencia',    Icon: Sparkles, color: '#7c3aed' },
}


const RARITY_COLORS = {
  common:    '#78716c',
  uncommon:  '#16a34a',
  rare:      '#2563eb',
  epic:      '#7c3aed',
  legendary: '#d97706',
}

const CONSUMABLE_META = {
  expedition_provisions: { icon: '🎒', label: 'Provisiones',        color: '#0891b2' },
  vial_aceleracion:      { icon: '🍶', label: 'Vial de Aceleración', color: '#16a34a' },
  amuleto_fortuna:       { icon: '🌟', label: 'Amuleto de Fortuna',  color: '#d97706' },
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
 *  ActiveExpeditionBanner                                                    *
 * ═══════════════════════════════════════════════════════════════════════════ */

function ActiveExpeditionBanner({ expedition, activeDungeon, onCollect }) {
  const [collecting, setCollecting] = useState(false)
  const { secondsLeft, canCollect, pct } = useExpeditionTimer(expedition)

  const dungeonName   = activeDungeon?.name ?? expedition.dungeons?.name ?? 'Mazmorra'
  const dungeonType   = activeDungeon?.type ?? expedition.dungeons?.type
  const typeColor     = DUNGEON_TYPE_META[dungeonType]?.color ?? '#6b7280'
  const usedConsumables = expedition.consumables_used ?? []

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
    <motion.div className="mb-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div
        className="relative flex items-center gap-3 px-4 py-3 bg-surface border rounded-xl overflow-hidden"
        style={{ borderColor: canCollect ? '#16a34a' : `color-mix(in srgb,${typeColor} 60%,var(--border))` }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb,${canCollect ? '#16a34a' : typeColor} 15%,transparent)` }}>
          {canCollect
            ? <PackageOpen size={16} strokeWidth={2} style={{ color: '#16a34a' }} />
            : <Compass size={16} strokeWidth={2} style={{ color: typeColor }} className="animate-[spin_8s_linear_infinite]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[14px] font-bold text-text truncate">{dungeonName}</span>
            {canCollect && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#16a34a]/15 text-[#16a34a] flex-shrink-0">LISTA</span>}
          </div>
          {usedConsumables.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {usedConsumables.map(id => {
                const m = CONSUMABLE_META[id]
                if (!m) return null
                return (
                  <span key={id} className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ background: `color-mix(in srgb,${m.color} 15%,var(--bg))`, color: m.color }}>
                    {m.icon} {m.label}
                  </span>
                )
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-none" style={{ width: `${pct}%`, background: canCollect ? '#16a34a' : typeColor }} />
            </div>
            <span className="text-[11px] font-semibold text-text-3 flex-shrink-0 tabular-nums">
              {canCollect ? '100%' : secondsLeft !== null ? fmtTime(secondsLeft) : '...'}
            </span>
          </div>
        </div>
        {canCollect && (
          <motion.button
            className={`px-3 py-2 rounded-lg font-bold text-[13px] text-white flex-shrink-0 transition-opacity ${collecting ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
            onClick={handleCollect} disabled={collecting}
            whileTap={!collecting ? { scale: 0.95 } : {}}
          >
            {collecting ? 'Recogiendo' : 'Recoger'}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  DungeonCard — card compacta, al pulsar abre PrepareModal                  *
 * ═══════════════════════════════════════════════════════════════════════════ */

function DungeonCard({
  dungeon, effectiveMins, hpCost, goldMin, goldMax, xpReward,
  equipChance, tacticChance, materialData,
  locked, busy, isExploring,
  onOpen,
}) {
  const meta      = DUNGEON_TYPE_META[dungeon.type]
  const matMeta   = materialData ? MATERIAL_META[materialData.resource] : null
  const slotChips = DUNGEON_TYPE_SLOTS[dungeon.type] ?? []
  const canOpen   = !locked && !busy && !isExploring

  const dimmed = locked || busy || isExploring

  return (
    <div
      className={`relative flex flex-col bg-surface border rounded-xl shadow-[var(--shadow-sm)] overflow-hidden
        transition-[box-shadow,border-color] duration-200
        ${dimmed ? 'opacity-55' : 'cursor-pointer'}
        ${isExploring ? 'border-blue-500/50' : 'border-border'}
        ${canOpen ? 'hover:border-[color-mix(in_srgb,var(--border)_60%,#6366f1)]' : ''}`}
      onClick={() => canOpen && onOpen(dungeon)}
    >
      {meta && <div className="h-[3px] w-full" style={{ background: meta.color }} />}

      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-[15px] font-bold text-text leading-tight">{dungeon.name}</h3>
          <DifficultyDots value={dungeon.difficulty} />
        </div>
        {/* Tipo + slots en una sola línea */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {meta && (
            <span className="text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: meta.color }}>
              {meta.label}
            </span>
          )}
          {slotChips.length > 0 && (
            <>
              <span className="text-[11px] text-border select-none">·</span>
              <span className="text-[12px] text-text-2">
                {slotChips.map(s => s.label).join(' · ')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Stats compactos */}
      <div className="px-4 pb-2.5 flex flex-col gap-1.5">
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

      {/* Footer — puramente visual, el click lo maneja la card */}
      <div className="flex items-center justify-end px-4 py-2.5 border-t border-border mt-auto pointer-events-none">
        <div className={`btn btn--primary flex-shrink-0 ${dimmed ? 'opacity-60' : ''}`}>
          {locked
            ? <><Lock size={13} strokeWidth={2} /><span>Nv. {dungeon.min_hero_level}</span></>
            : isExploring ? <><Compass size={14} strokeWidth={2} className="animate-[spin_8s_linear_infinite]" /><span>Explorando…</span></>
            : busy ? <><Compass size={13} strokeWidth={2} /><span>En expedición</span></>
            : <><span>Preparar</span><ChevronRight size={15} strokeWidth={2} /></>}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  PrepareExpeditionModal                                                    *
 * ═══════════════════════════════════════════════════════════════════════════ */

function StatRow({ icon: Icon, iconColor, label, baseValue, finalValue, changed }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-2">
        <Icon size={14} strokeWidth={2} color={iconColor} className="flex-shrink-0" />
        <span className="text-[13px] font-semibold text-text-2">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {changed && <span className="text-[12px] text-text-3 line-through">{baseValue}</span>}
        <span className="text-[14px] font-bold" style={{ color: changed ? '#16a34a' : 'var(--text)' }}>{finalValue}</span>
      </div>
    </div>
  )
}

function ConsumableToggle({ id, qty, active, disabled, onToggle }) {
  const meta = CONSUMABLE_META[id]
  if (!meta) return null
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left w-full ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.98]'}`}
      style={{
        borderColor: active ? meta.color : `color-mix(in srgb,${meta.color} 25%,var(--border))`,
        background:  active ? `color-mix(in srgb,${meta.color} 10%,var(--surface))` : 'var(--surface)',
      }}
    >
      <span className="text-[20px] leading-none flex-shrink-0">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold" style={{ color: active ? meta.color : 'var(--text)' }}>{meta.label}</p>
        <p className="text-[12px] text-text-3 mt-0.5">{getConsumableEffect(id)}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-surface-2 text-text-3">×{qty}</span>
        <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors"
          style={{ borderColor: active ? meta.color : 'var(--border)', background: active ? meta.color : 'transparent' }}>
          {active && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
        </div>
      </div>
    </button>
  )
}

function getConsumableEffect(id) {
  switch (id) {
    case 'expedition_provisions': return '+15% oro · +10% XP'
    case 'vial_aceleracion':      return '−35% duración de la expedición'
    case 'amuleto_fortuna':       return '+80% probabilidad de drop de equipo'
    default: return ''
  }
}

function PrepareExpeditionModal({
  dungeon, onClose, onStart,
  preview, craftedItems, equipHealth, disabled, disabledReason,
}) {
  const [sel, setSel]         = useState({ provisions: false, vial: false, amuleto: false })
  const mountedAt             = useRef(Date.now())
  function handleBackdrop() { if (Date.now() - mountedAt.current > 120) onClose() }

  const provisions = craftedItems?.expedition_provisions ?? 0
  const vials      = craftedItems?.vial_aceleracion      ?? 0
  const amuletos   = craftedItems?.amuleto_fortuna       ?? 0
  const hasAny     = provisions > 0 || vials > 0 || amuletos > 0

  const meta      = DUNGEON_TYPE_META[dungeon.type]
  const slotChips = DUNGEON_TYPE_SLOTS[dungeon.type] ?? []
  const matMeta   = preview.materialData ? MATERIAL_META[preview.materialData.resource] : null

  // Cálculos dinámicos con consumibles activos
  const vialActive     = sel.vial && vials > 0
  const amuletoActive  = sel.amuleto && amuletos > 0
  const provActive     = sel.provisions && provisions > 0

  const finalMins     = vialActive ? Math.max(1, Math.round(preview.effectiveMins * 0.65)) : preview.effectiveMins
  const finalEquip    = amuletoActive ? Math.min(1, preview.equipChance * 1.80) : preview.equipChance
  const finalGoldMin  = provActive ? Math.round(preview.goldMin * 1.15) : preview.goldMin
  const finalGoldMax  = provActive ? Math.round(preview.goldMax * 1.15) : preview.goldMax
  const finalXp       = provActive ? Math.round(preview.xpReward * 1.10) : preview.xpReward

  const minsChanged  = finalMins     !== preview.effectiveMins
  const equipChanged = finalEquip    !== preview.equipChance
  const goldChanged  = finalGoldMin  !== preview.goldMin
  const xpChanged    = finalXp       !== preview.xpReward

  function toggle(key) {
    setSel(s => ({ ...s, [key]: !s[key] }))
  }

  function handleStart() {
    onStart(dungeon, sel)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={handleBackdrop}>
      <motion.div
        className="relative bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-lg)] w-full sm:max-w-md max-h-[90vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header con barra de color */}
        {meta && <div className="h-1 w-full rounded-t-2xl sm:rounded-t-2xl" style={{ background: meta.color }} />}
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] mb-0.5" style={{ color: meta?.color ?? '#6b7280' }}>
              Preparar expedición
            </p>
            <h3 className="text-[18px] font-bold text-text leading-tight">{dungeon.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {meta && <span className="text-[11px] font-semibold text-text-2">{meta.label}</span>}
              <DifficultyDots value={dungeon.difficulty} size={6} />
            </div>
          </div>
          <button className="btn btn--ghost btn--icon flex-shrink-0 mt-1" onClick={onClose}><X size={16} strokeWidth={2} /></button>
        </div>

        <div className="px-5 pt-4 pb-2 flex flex-col gap-5">

          {/* Loot primario */}
          <div>
            <p className="text-[11px] font-bold text-text-3 uppercase tracking-[0.08em] mb-2">Loot principal</p>
            <div className="flex items-center gap-2 flex-wrap">
              {slotChips.map(({ slot, label }) => (
                <span key={slot} className="text-[13px] font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: `color-mix(in srgb,${meta?.color ?? '#6b7280'} 13%,var(--bg))`, color: meta?.color ?? '#6b7280' }}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Consumibles */}
          {hasAny && !disabled && (
            <div>
              <p className="text-[11px] font-bold text-text-3 uppercase tracking-[0.08em] mb-2">Consumibles</p>
              <div className="flex flex-col gap-2">
                {provisions > 0 && <ConsumableToggle id="expedition_provisions" qty={provisions} active={sel.provisions} onToggle={() => toggle('provisions')} />}
                {vials > 0      && <ConsumableToggle id="vial_aceleracion"      qty={vials}      active={sel.vial}       onToggle={() => toggle('vial')} />}
                {amuletos > 0   && <ConsumableToggle id="amuleto_fortuna"       qty={amuletos}   active={sel.amuleto}    onToggle={() => toggle('amuleto')} />}
              </div>
            </div>
          )}

          {/* Resumen de stats — con preview dinámico */}
          <div>
            <p className="text-[11px] font-bold text-text-3 uppercase tracking-[0.08em] mb-1">Resumen</p>
            <div className="divide-y divide-border">
              <StatRow icon={Clock}  iconColor="#6366f1" label="Duración"
                baseValue={fmtDuration(preview.effectiveMins)} finalValue={fmtDuration(finalMins)} changed={minsChanged} />
              <StatRow icon={Heart}  iconColor="#dc2626" label="Coste HP"
                baseValue={`-${preview.hpCost}`} finalValue={`-${preview.hpCost}`} changed={false} />
              <StatRow icon={Coins}  iconColor="#d97706" label="Oro"
                baseValue={`${preview.goldMin}–${preview.goldMax}`} finalValue={`${finalGoldMin}–${finalGoldMax}`} changed={goldChanged} />
              <StatRow icon={Star}   iconColor="#0369a1" label="XP"
                baseValue={`${preview.xpReward}`} finalValue={`${finalXp}`} changed={xpChanged} />
              <StatRow icon={Sword}  iconColor="#7c3aed" label="Drop equipo"
                baseValue={fmtPct(preview.equipChance)} finalValue={fmtPct(finalEquip)} changed={equipChanged} />
              <StatRow icon={Brain}  iconColor="#0891b2" label="Drop táctica"
                baseValue={fmtPct(preview.tacticChance)} finalValue={fmtPct(preview.tacticChance)} changed={false} />
              {preview.materialData && matMeta && (
                <StatRow icon={matMeta.Icon} iconColor={matMeta.color} label={matMeta.label}
                  baseValue={`${fmtPct(preview.materialData.chance)} ×${preview.materialData.min}–${preview.materialData.max}`}
                  finalValue={`${fmtPct(preview.materialData.chance)} ×${preview.materialData.min}–${preview.materialData.max}`}
                  changed={false} />
              )}
              {preview.durLoss > 0 && (
                <StatRow icon={Wrench} iconColor="#78716c" label="Desgaste equipo"
                  baseValue={`${preview.durLoss} pts`} finalValue={`${preview.durLoss} pts`} changed={false} />
              )}
            </div>
          </div>

          {/* Advertencia equipo dañado */}
          {equipHealth?.hasDamagedGear && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[color-mix(in_srgb,#dc2626_8%,var(--bg))] border border-[color-mix(in_srgb,#dc2626_25%,var(--border))]">
              <AlertTriangle size={14} color="#dc2626" strokeWidth={2} className="flex-shrink-0" />
              <p className="text-[12px] font-semibold text-[#dc2626]">Equipo dañado — considera reparar antes</p>
            </div>
          )}
        </div>

        {/* Botón confirmar */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-4">
          <motion.button
            className="btn btn--primary btn--full"
            onClick={handleStart}
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
 *  RewardModal                                                               *
 * ═══════════════════════════════════════════════════════════════════════════ */

function RewardModal({ reward, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <motion.div
        className="relative bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-sm overflow-hidden"
        initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <div>
            <p className="text-[17px] font-bold text-text">¡Expedición completada!</p>
            <p className="text-[13px] text-text-3 mt-0.5">Has vuelto con recompensas</p>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><X size={16} strokeWidth={2} /></button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
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

          {reward.levelUp && (
            <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#16a34a_8%,var(--bg))] border border-[color-mix(in_srgb,#16a34a_25%,var(--border))] rounded-xl px-3.5 py-3">
              <TrendingUp size={18} color="#16a34a" strokeWidth={2} />
              <p className="text-[14px] font-bold text-[#16a34a]">¡Subida de nivel!</p>
            </div>
          )}

          {reward.materialDrop && (() => {
            const mat = MATERIAL_META[reward.materialDrop.resource]
            if (!mat) return null
            const MIcon = mat.Icon
            return (
              <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border"
                style={{ background: `color-mix(in srgb,${mat.color} 8%,var(--bg))`, borderColor: `color-mix(in srgb,${mat.color} 25%,var(--border))` }}>
                <MIcon size={18} color={mat.color} strokeWidth={2} />
                <div>
                  <p className="text-[18px] font-bold text-text leading-none">+{reward.materialDrop.qty}</p>
                  <p className="text-[11px] text-text-3 mt-0.5">{mat.label}</p>
                </div>
              </div>
            )
          })()}

          {reward.itemDrop && reward.itemDrop.item_catalog && (
            <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border"
              style={{
                background: `color-mix(in srgb,${RARITY_COLORS[reward.itemDrop.item_catalog.rarity] ?? '#78716c'} 8%,var(--bg))`,
                borderColor: `color-mix(in srgb,${RARITY_COLORS[reward.itemDrop.item_catalog.rarity] ?? '#78716c'} 25%,var(--border))`,
              }}>
              <Sword size={18} color={RARITY_COLORS[reward.itemDrop.item_catalog.rarity] ?? '#78716c'} strokeWidth={2} />
              <div>
                <p className="text-[14px] font-bold text-text leading-tight">{reward.itemDrop.item_catalog.name}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: RARITY_COLORS[reward.itemDrop.item_catalog.rarity] ?? '#78716c' }}>
                  {reward.itemDrop.item_catalog.rarity}
                </p>
              </div>
            </div>
          )}

          {reward.itemDrop && reward.itemDrop.full && (
            <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border border-[color-mix(in_srgb,#dc2626_25%,var(--border))] bg-[color-mix(in_srgb,#dc2626_6%,var(--bg))]">
              <AlertTriangle size={18} color="#dc2626" strokeWidth={2} />
              <p className="text-[13px] font-semibold text-[#dc2626]">Mochila llena — equipo perdido</p>
            </div>
          )}

          {reward.tacticDrop && (reward.tacticDrop.tactic_catalog ?? reward.tacticDrop.tactic) && (
            <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border border-[color-mix(in_srgb,#0891b2_25%,var(--border))] bg-[color-mix(in_srgb,#0891b2_8%,var(--bg))]">
              <Brain size={18} color="#0891b2" strokeWidth={2} />
              <div>
                <p className="text-[14px] font-bold text-text leading-tight">
                  {(reward.tacticDrop.tactic_catalog ?? reward.tacticDrop.tactic)?.name}
                </p>
                <p className="text-[11px] font-semibold mt-0.5 text-[#0891b2]">
                  {reward.tacticDrop.isNew ? 'Nueva táctica'
                    : reward.tacticDrop.leveledUp ? `Nv. ${reward.tacticDrop.newLevel}`
                    : reward.tacticDrop.compensated ? `+${reward.tacticDrop.goldCompensation} oro`
                    : 'Táctica'}
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
  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const heroId               = useHeroId()
  const queryClient          = useQueryClient()
  const { hero, loading: heroLoading }         = useHero(heroId)
  const { dungeons, loading: dungeonsLoading } = useDungeons()
  const { expedition, loading: expLoading, setExpedition } = useActiveExpedition(hero?.id)
  const { items }            = useInventory(heroId)
  const { inventory: craftedItems } = useCraftedItems(userId)
  const equipHealth          = useEquipmentHealth(items)
  const [reward, setReward]  = useState(null)
  const [prepDungeon, setPrepDungeon] = useState(null)   // mazmorra abierta en PrepareModal
  const [, forceUpdate]      = useReducer(x => x + 1, 0)
  const topRef               = useRef(null)

  useEffect(() => { const id = setInterval(forceUpdate, 10000); return () => clearInterval(id) }, [])
  useWakeLock(!!expedition)

  const agilityFactor = hero ? agilityDurationFactor(hero.agility) : 1
  const atkMultiplier = hero ? calcAttackMultiplier(hero.attack)   : 1
  const heroLevel     = hero?.level ?? 1

  const { available, locked: lockedDungeons } = useMemo(() => {
    if (!dungeons) return { available: [], locked: [] }
    const avail = [], lock = []
    for (const d of dungeons) {
      if (heroLevel >= d.min_hero_level) avail.push(d)
      else lock.push(d)
    }
    avail.sort((a, b) => a.difficulty - b.difficulty)
    lock.sort((a, b) => a.min_hero_level - b.min_hero_level)
    return { available: avail, locked: lock }
  }, [dungeons, heroLevel])

  const activeDungeon = useMemo(
    () => expedition ? dungeons?.find(d => d.id === expedition.dungeon_id) : null,
    [expedition, dungeons],
  )

  function computePreview(d) {
    const effectiveMins = Math.round(d.duration_minutes * agilityFactor)
    const agilityPct    = agilityFactor < 1 ? Math.round((1 - agilityFactor) * 100) : 0
    const profile       = DUNGEON_DROP_PROFILE[d.name] ?? {}

    const hpCost      = expeditionHpCost(hero?.max_hp ?? 100, d.duration_minutes, d.difficulty, hero?.strength ?? 0)
    const baseHpCost  = expeditionHpCost(hero?.max_hp ?? 100, d.duration_minutes, d.difficulty, 0)
    const strReduction = baseHpCost > hpCost ? baseHpCost - hpCost : 0

    const goldMin  = Math.round(d.gold_min  * atkMultiplier * (profile.goldMult ?? 1))
    const goldMax  = Math.round(d.gold_max  * atkMultiplier * (profile.goldMult ?? 1))
    const atkPct   = atkMultiplier > 1 ? Math.round((atkMultiplier - 1) * 100) : 0
    const xpReward = Math.round(d.experience_reward * atkMultiplier * (profile.xpMult ?? 1))

    const equipChance  = itemDropChance(d.difficulty) * (profile.itemMult ?? 1)
    const tacticChance = tacticDropChance(hero?.intelligence ?? 0) * (profile.tacticMult ?? 1)
    const baseTacticCh = tacticDropChance(0) * (profile.tacticMult ?? 1)
    const intellBonus  = tacticChance > baseTacticCh ? Math.round((tacticChance - baseTacticCh) * 100) : 0

    const durLoss      = calcDurabilityLoss(d.difficulty, hero?.defense ?? 0)
    const durLossBase  = calcDurabilityLoss(d.difficulty, 0)
    const defReduction = durLossBase > durLoss ? durLossBase - durLoss : 0

    const materialData = MATERIAL_DROP_DATA[d.name] ?? null
    const heroHpNow    = interpolateHp(hero, Date.now())
    const isLocked     = heroLevel < d.min_hero_level
    const busy         = (expedition ? 'exploring' : hero?.status ?? 'idle') !== 'idle'
    const lowHp        = !isLocked && !busy && (heroHpNow ?? 0) <= hpCost

    let disabledReason = null
    if (isLocked)   disabledReason = `Nv. ${d.min_hero_level} requerido`
    else if (busy)  disabledReason = 'Héroe ocupado'
    else if (lowHp) disabledReason = 'HP insuficiente'

    return {
      effectiveMins, agilityPct,
      hpCost, strReduction,
      goldMin, goldMax, atkPct,
      xpReward,
      equipChance, tacticChance, intellBonus,
      durLoss, defReduction,
      materialData,
      locked: isLocked, busy, lowHp, disabled: !!disabledReason, disabledReason,
    }
  }

  async function handleStart(dungeon, sel = {}) {
    const now = Date.now()
    const vialActive  = sel.vial && (craftedItems?.vial_aceleracion ?? 0) > 0
    const effectiveMs = Math.round(dungeon.duration_minutes * agilityFactor * (vialActive ? 0.65 : 1)) * 60_000
    const consumablesUsed = [
      sel.provisions && (craftedItems?.expedition_provisions ?? 0) > 0 ? 'expedition_provisions' : null,
      sel.vial       && (craftedItems?.vial_aceleracion      ?? 0) > 0 ? 'vial_aceleracion'      : null,
      sel.amuleto    && (craftedItems?.amuleto_fortuna       ?? 0) > 0 ? 'amuleto_fortuna'       : null,
    ].filter(Boolean)
    setExpedition({
      id: '__optimistic__',
      dungeon_id: dungeon.id,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + effectiveMs).toISOString(),
      consumables_used: consumablesUsed,
    })
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    try {
      const data = await apiPost('/api/expedition-start', {
        dungeonId:     dungeon.id,
        heroId:        hero?.id,
        useProvisions: sel.provisions && (craftedItems?.expedition_provisions ?? 0) > 0,
        useVial:       sel.vial       && (craftedItems?.vial_aceleracion      ?? 0) > 0,
        useAmuleto:    sel.amuleto    && (craftedItems?.amuleto_fortuna       ?? 0) > 0,
      })
      setExpedition(exp => exp ? { ...exp, ends_at: data.endsAt } : exp)
      if (data.provisionsUsed || data.vialUsed || data.amuletoUsed) {
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
    setReward({
      ...(data.rewards ?? {}),
      levelUp:      data.levelUp ?? false,
      materialDrop: data.materialDrop ?? null,
      itemDrop:     data.drop ?? null,
      tacticDrop:   data.tacticDrop ?? null,
    })
    setExpedition(null)
    setTimeout(() => {
      triggerResourceFlash()
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroTactics(heroId) })
    }, 100)
  }

  if (heroLoading || dungeonsLoading || expLoading) {
    return <div className="text-text-3 text-[15px] p-10 text-center">Cargando mazmorras...</div>
  }

  return (
    <div className="dungeons-section" ref={topRef}>
      {createPortal(
        <AnimatePresence>
          {reward && <RewardModal reward={reward} onClose={() => setReward(null)} />}
        </AnimatePresence>,
        document.body
      )}

      {/* Modal de preparación */}
      {createPortal(
        <AnimatePresence>
          {prepDungeon && (() => {
            const p = computePreview(prepDungeon)
            return (
              <PrepareExpeditionModal
                dungeon={prepDungeon}
                onClose={() => setPrepDungeon(null)}
                onStart={handleStart}
                preview={p}
                craftedItems={craftedItems}
                equipHealth={equipHealth}
                disabled={p.disabled}
                disabledReason={p.disabledReason}
              />
            )
          })()}
        </AnimatePresence>,
        document.body
      )}

      {/* Expedición activa */}
      {expedition && (
        <ActiveExpeditionBanner
          expedition={expedition}
          activeDungeon={activeDungeon}
          onCollect={handleCollect}
        />
      )}

      {/* Grid */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-3" variants={listVariants} initial="initial" animate="animate">
        {available.map(dungeon => {
          const p = computePreview(dungeon)
          return (
            <motion.div key={dungeon.id} variants={cardVariants}>
              <DungeonCard
                dungeon={dungeon} effectiveMins={p.effectiveMins}
                hpCost={p.hpCost} goldMin={p.goldMin} goldMax={p.goldMax} xpReward={p.xpReward}
                equipChance={p.equipChance} tacticChance={p.tacticChance}
                materialData={p.materialData}
                locked={false} busy={p.busy} lowHp={p.lowHp}
                isExploring={expedition?.dungeon_id === dungeon.id}
                onOpen={setPrepDungeon}
              />
            </motion.div>
          )
        })}
        {lockedDungeons.map(dungeon => {
          const p = computePreview(dungeon)
          return (
            <motion.div key={dungeon.id} variants={cardVariants}>
              <DungeonCard
                dungeon={dungeon} effectiveMins={p.effectiveMins}
                hpCost={p.hpCost} goldMin={p.goldMin} goldMax={p.goldMax} xpReward={p.xpReward}
                equipChance={p.equipChance} tacticChance={p.tacticChance}
                materialData={p.materialData}
                locked={true} busy={false} lowHp={false}
                onOpen={() => {}}
              />
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

export default Dungeons
