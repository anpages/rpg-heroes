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
  Coins, Star, Clock, ChevronRight, PackageOpen, X, Sword,
  Layers, Sparkles, FlaskConical, Zap, Heart, Brain,
  Wrench, AlertTriangle, Crosshair, Lock,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { PotionPanel } from '../components/PotionPanel'

const listVariants = {
  animate: { transition: { staggerChildren: 0.07 } },
}
const cardVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
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

function DifficultyDots({ value }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`w-[7px] h-[7px] rounded-full ${i < value ? 'bg-[#dc2626]' : 'bg-border'}`}
        />
      ))}
    </div>
  )
}

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

/** Computes average equipment durability % across equipped items */
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
  'time_reduction',
  'xp_boost',
  'loot_boost',
  'gold_boost',
  'card_guaranteed',
]

/* ─── Filtros ─────────────────────────────────────────────────────────────── */

const FILTERS_BASE = [
  { id: 'recommended', label: 'Recomendadas', icon: Crosshair },
  { id: 'equipment',   label: 'Equipo',       icon: Sword     },
  { id: 'materials',   label: 'Materiales',   icon: Layers    },
  { id: 'tactics',     label: 'Tácticas',     icon: Brain     },
]

/** Filtra y ordena las mazmorras según el filtro activo */
function filterDungeons(dungeons, filter, heroLevel) {
  if (!dungeons) return []

  switch (filter) {
    case 'recommended': {
      // Available dungeons near hero level + always include short dungeons (≤20 min)
      return dungeons
        .filter(d => heroLevel >= d.min_hero_level)
        .filter(d => d.duration_minutes <= 20 || d.min_hero_level >= Math.max(1, heroLevel - 4))
        .sort((a, b) => a.difficulty - b.difficulty)
    }
    case 'equipment': {
      // Dungeons known for equipment (all available ones, sorted by drop chance = difficulty)
      return dungeons
        .filter(d => heroLevel >= d.min_hero_level)
        .sort((a, b) => b.difficulty - a.difficulty)
    }
    case 'materials': {
      // Only dungeons that drop materials
      return dungeons
        .filter(d => heroLevel >= d.min_hero_level && MATERIAL_DROP_DATA[d.name])
        .sort((a, b) => {
          const ca = MATERIAL_DROP_DATA[a.name]?.chance ?? 0
          const cb = MATERIAL_DROP_DATA[b.name]?.chance ?? 0
          return cb - ca
        })
    }
    case 'tactics': {
      // All available, sorted by difficulty (higher = more tactic XP context)
      return dungeons
        .filter(d => heroLevel >= d.min_hero_level)
        .sort((a, b) => b.difficulty - a.difficulty)
    }
    case 'locked': {
      return dungeons
        .filter(d => heroLevel < d.min_hero_level)
        .sort((a, b) => a.min_hero_level - b.min_hero_level)
    }
    case 'all':
    default: {
      return [...dungeons].sort((a, b) => a.difficulty - b.difficulty)
    }
  }
}

/** A single stat line in the dungeon preview */
function StatLine({ icon: Icon, iconColor, label, value, baseValue, bonusLabel, bonusColor, warning }) {
  const hasBonus = baseValue != null && value !== baseValue
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon size={14} strokeWidth={2} color={iconColor} className="flex-shrink-0" />
      <span className="text-[13px] font-semibold text-text-2">{label}</span>
      <span className="text-[14px] font-bold text-text">{value}</span>
      {hasBonus && (
        <>
          <span className="text-[12px] text-text-3 line-through">{baseValue}</span>
          <span className="text-[11px] font-bold" style={{ color: bonusColor ?? '#16a34a' }}>
            {bonusLabel}
          </span>
        </>
      )}
      {warning && (
        <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#dc2626]">
          <AlertTriangle size={11} strokeWidth={2.5} />
          {warning}
        </span>
      )}
    </div>
  )
}


function DungeonCard({
  dungeon, heroLevel, heroStatus, expedition, onStart, onCollect,
  heroHpNow, heroMaxHp, agilityFactor, atkMultiplier = 1,
  heroStrength = 0, heroDefense = 0, heroIntelligence = 0,
  weeklyModifier = null, equipHealth,
}) {
  const locked   = heroLevel < dungeon.min_hero_level
  const isActive = expedition?.dungeon_id === dungeon.id
  const busy     = heroStatus !== 'idle' && !isActive
  const hpCost   = expeditionHpCost(heroMaxHp, dungeon.duration_minutes, dungeon.difficulty, heroStrength)
  const lowHp    = !isActive && !locked && !busy && (heroHpNow ?? 0) <= hpCost
  const disabled = locked || busy || lowHp
  const meta     = dungeon.type ? DUNGEON_TYPE_META[dungeon.type] : null
  const isWeekly = weeklyModifier?.dungeon_id === dungeon.id
  const weeklyMeta = isWeekly ? weeklyModifier?.modifier : null
  const isShort  = dungeon.duration_minutes <= 20

  // Computed preview values
  const durMult      = isWeekly && weeklyMeta?.durationMult ? weeklyMeta.durationMult : 1
  const effectiveMins = Math.round(dungeon.duration_minutes * (agilityFactor ?? 1) * durMult)
  const baseMins      = dungeon.duration_minutes
  const agilityPct    = agilityFactor < 1 ? Math.round((1 - agilityFactor) * 100) : 0

  const goldMin       = Math.round(dungeon.gold_min * atkMultiplier)
  const goldMax       = Math.round(dungeon.gold_max * atkMultiplier)
  const atkPct        = atkMultiplier > 1 ? Math.round((atkMultiplier - 1) * 100) : 0

  const baseHpCost    = expeditionHpCost(heroMaxHp, dungeon.duration_minutes, dungeon.difficulty, 0)
  const strReduction  = baseHpCost > hpCost ? baseHpCost - hpCost : 0

  const equipChance   = itemDropChance(dungeon.difficulty)
  const tacticChance  = tacticDropChance(heroIntelligence)
  const baseTacticCh  = tacticDropChance(0)
  const intellBonus   = tacticChance > baseTacticCh ? Math.round((tacticChance - baseTacticCh) * 100) : 0

  const durLoss       = calcDurabilityLoss(dungeon.difficulty, heroDefense)
  const durLossBase   = calcDurabilityLoss(dungeon.difficulty, 0)
  const defReduction  = durLossBase > durLoss ? durLossBase - durLoss : 0

  const materialData  = MATERIAL_DROP_DATA[dungeon.name]
  const matMeta       = materialData ? MATERIAL_META[materialData.resource] : null

  const [collecting, setCollecting] = useState(false)
  const timer = useExpeditionTimer(isActive ? expedition : null)

  async function handleCollect() {
    setCollecting(true)
    try {
      const data = await apiPost('/api/expedition-collect', { expeditionId: expedition.id })
      onCollect(data)
      setCollecting(false)
    } catch (err) {
      notify.error(err.message)
      setCollecting(false)
    }
  }

  return (
    <div
      className={`flex flex-col bg-surface border rounded-xl shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-200 overflow-hidden
      ${isActive
        ? 'border-[var(--blue-300)] bg-[color-mix(in_srgb,var(--blue-50)_60%,var(--surface))] dark:border-[var(--blue-300)] dark:bg-[color-mix(in_srgb,var(--blue-300)_8%,var(--surface))]'
        : locked
          ? 'border-border opacity-55'
          : 'border-border hover:shadow-[var(--shadow-md)] hover:border-border-2'
      }`}
      style={isWeekly && weeklyMeta && !isActive ? {
        borderColor: `color-mix(in srgb, ${weeklyMeta.color} 55%, var(--border))`,
        boxShadow:   `0 0 0 1px color-mix(in srgb, ${weeklyMeta.color} 30%, transparent), var(--shadow-sm)`,
        background:  `color-mix(in srgb, ${weeklyMeta.color} 4%, var(--surface))`,
      } : undefined}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3 className="text-[16px] font-bold text-text">{dungeon.name}</h3>
            {isShort && (
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,#16a34a_12%,var(--bg))] text-[#16a34a] border border-[color-mix(in_srgb,#16a34a_25%,var(--border))]">
                Rápida
              </span>
            )}
            {meta && (
              <span className="text-[11px] font-bold uppercase tracking-[0.07em] opacity-85" style={{ color: meta.color }}>
                {meta.label}
              </span>
            )}
            {isWeekly && weeklyMeta && (
              <span
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.06em]"
                style={{ color: weeklyMeta.color }}
                title={`Desafío semanal · ${weeklyMeta.name} — ${weeklyMeta.description}`}
              >
                <Zap size={11} strokeWidth={2.5} />
                {weeklyMeta.name}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <DifficultyDots value={dungeon.difficulty} />
          </div>
        </div>
        <p className="text-[13px] text-text-3 leading-[1.45] line-clamp-2">{dungeon.description}</p>
      </div>

      {/* Stat preview grid — only when not active */}
      {!isActive && !locked && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {/* Duration */}
          <StatLine
            icon={Clock} iconColor="#6366f1"
            label="" value={effectiveMins >= 60 ? `${Math.floor(effectiveMins / 60)}h${effectiveMins % 60 > 0 ? ` ${effectiveMins % 60}m` : ''}` : `${effectiveMins}m`}
            baseValue={agilityPct > 0 ? `${baseMins}m` : null}
            bonusLabel={agilityPct > 0 ? `−${agilityPct}% Agi` : null}
            bonusColor="#16a34a"
          />

          {/* Gold range */}
          <StatLine
            icon={Coins} iconColor="#d97706"
            label="" value={`${goldMin}–${goldMax}`}
            baseValue={atkPct > 0 ? `${dungeon.gold_min}–${dungeon.gold_max}` : null}
            bonusLabel={atkPct > 0 ? `+${atkPct}% Atq` : null}
            bonusColor="#d97706"
          />

          {/* HP cost */}
          <StatLine
            icon={Heart} iconColor="#dc2626"
            label="" value={`−${hpCost} HP`}
            baseValue={strReduction > 0 ? `−${baseHpCost}` : null}
            bonusLabel={strReduction > 0 ? `−${strReduction} Fza` : null}
            bonusColor="#16a34a"
          />

          {/* XP */}
          <StatLine
            icon={Star} iconColor="#0369a1"
            label="" value={`${Math.round(dungeon.experience_reward * atkMultiplier)} XP`}
            baseValue={atkPct > 0 ? `${dungeon.experience_reward}` : null}
            bonusLabel={atkPct > 0 ? `+${atkPct}% Atq` : null}
            bonusColor="#0369a1"
          />

          {/* Equipment drop */}
          <StatLine
            icon={Sword} iconColor="#7c3aed"
            label="Equipo" value={fmtPct(equipChance)}
            warning={equipHealth?.hasDamagedGear ? 'Dañado' : null}
          />

          {/* Tactic drop */}
          <StatLine
            icon={Brain} iconColor="#0891b2"
            label="Táctica" value={fmtPct(tacticChance)}
            baseValue={intellBonus > 0 ? fmtPct(baseTacticCh) : null}
            bonusLabel={intellBonus > 0 ? `+${intellBonus}% Int` : null}
            bonusColor="#0891b2"
          />

          {/* Durability loss */}
          {durLoss > 0 && (
            <StatLine
              icon={Wrench} iconColor="#78716c"
              label="Desgaste" value={`${durLoss} pts`}
              baseValue={defReduction > 0 ? `${durLossBase}` : null}
              bonusLabel={defReduction > 0 ? `−${defReduction} Def` : null}
              bonusColor="#16a34a"
            />
          )}

          {/* Material drop */}
          {materialData && matMeta && (
            <StatLine
              icon={matMeta.Icon} iconColor={matMeta.color}
              label={matMeta.label} value={`${fmtPct(materialData.chance)} (${materialData.min}–${materialData.max})`}
            />
          )}
        </div>
      )}

      {/* Loot type badge — when locked, show minimal info */}
      {locked && meta && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-text-3">
            <Star size={12} strokeWidth={2} className="inline mr-1" />
            Nv. {dungeon.min_hero_level}+
          </span>
          <span className="text-[12px] font-semibold opacity-75" style={{ color: meta.color }}>
            {meta.loot}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border mt-auto">
        {isActive ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 h-1.5 bg-[var(--blue-100)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--blue-400)] rounded-full"
                style={{ width: `${timer.pct}%`, transition: timer.isMounted ? 'width 1s linear' : 'none' }}
              />
            </div>
            <span className={`text-[13px] font-semibold whitespace-nowrap flex-shrink-0 ${timer.canCollect ? 'text-[#16a34a]' : 'text-text-3'}`}>
              {timer.canCollect ? '¡Lista!' : timer.secondsLeft !== null ? fmtTime(timer.secondsLeft) : '...'}
            </span>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {isActive ? (
          <motion.button
            className="btn btn--primary flex-shrink-0"
            onClick={handleCollect}
            disabled={!timer.canCollect || collecting}
            whileTap={(!timer.canCollect || collecting) ? {} : { scale: 0.96 }}
            whileHover={(!timer.canCollect || collecting) ? {} : { scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <PackageOpen size={15} strokeWidth={2} />
            {collecting ? 'Recogiendo...' : 'Recoger'}
          </motion.button>
        ) : (
          <motion.button
            className="btn btn--primary flex-shrink-0"
            onClick={() => onStart(dungeon)}
            disabled={disabled}
            whileTap={disabled ? {} : { scale: 0.96 }}
            whileHover={disabled ? {} : { scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {locked
              ? `Nv. ${dungeon.min_hero_level} requerido`
              : busy
                ? 'Héroe ocupado'
                : lowHp
                  ? 'HP insuficiente'
                  : <><span>Explorar</span><ChevronRight size={15} strokeWidth={2} /></>
            }
          </motion.button>
        )}
      </div>
    </div>
  )
}

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
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <div>
            <p className="text-[17px] font-bold text-text">¡Expedición completada!</p>
            <p className="text-[13px] text-text-3 mt-0.5">Has vuelto con recompensas</p>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Cerrar">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Resources */}
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,#d97706_8%,var(--bg))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] rounded-xl px-3.5 py-3">
            <Coins size={18} color="#d97706" strokeWidth={2} />
            <div>
              <p className="text-[18px] font-bold text-text leading-none">{reward.gold}</p>
              <p className="text-[11px] text-text-3 mt-0.5">Oro</p>
              {reward.goldBonus > 0 && (
                <p className="flex items-center gap-1 text-[10px] font-bold mt-1" style={{ color: '#d97706' }}>
                  <FlaskConical size={10} strokeWidth={2.5} />
                  +{reward.goldBonus} poción
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
                  <FlaskConical size={10} strokeWidth={2.5} />
                  +{reward.xpBonus} poción
                </p>
              )}
            </div>
          </div>
          {reward.materialDrop && (() => {
            const mat  = MATERIAL_META[reward.materialDrop.resource]
            if (!mat) return null
            const Icon = mat.Icon
            return (
              <div className="col-span-2 flex items-center gap-2.5 rounded-xl px-3.5 py-3 border"
                style={{
                  background:   `color-mix(in srgb, ${mat.color} 8%, var(--bg))`,
                  borderColor:  `color-mix(in srgb, ${mat.color} 25%, var(--border))`,
                }}>
                <Icon size={18} color={mat.color} strokeWidth={2} />
                <div>
                  <p className="text-[18px] font-bold text-text leading-none">+{reward.materialDrop.qty}</p>
                  <p className="text-[11px] text-text-3 mt-0.5">{mat.label}</p>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button className="btn btn--primary btn--full" onClick={onClose}>
            Continuar
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function Dungeons() {
  const userId                = useAppStore(s => s.userId)
  const triggerResourceFlash  = useAppStore(s => s.triggerResourceFlash)
  const heroId                = useHeroId()
  const queryClient = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { dungeons, loading: dungeonsLoading, weeklyModifier, weeklyLoading } = useDungeons(heroId)
  const { expedition, loading: expLoading, setExpedition } = useActiveExpedition(hero?.id)
  const { items } = useInventory(heroId)
  const equipHealth = useEquipmentHealth(items)
  const [reward, setReward] = useState(null)
  const [filter, setFilter] = useState('recommended')
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])

  useWakeLock(!!expedition)

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

  // Si el filtro activo ya no tiene sentido, volver a recomendadas
  useEffect(() => {
    if (filter === 'locked' && lockedCount === 0) setFilter('recommended')
    if (filter === 'all') setFilter('recommended')
  }, [filter, lockedCount])

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

    try {
      const data = await apiPost('/api/expedition-start', { dungeonId: dungeon.id, heroId: hero?.id })
      setExpedition(exp => exp ? { ...exp, ends_at: data.endsAt } : exp)
      queryClient.invalidateQueries({ queryKey: queryKeys.activeExpedition(hero?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
    } catch (err) {
      setExpedition(null)
      notify.error(err.message)
    }
  }

  function handleCollect(data) {
    setReward({ ...(data.rewards ?? {}), materialDrop: data.materialDrop ?? null })
    if (data.drop?.item_catalog)      notify.itemDrop(data.drop.item_catalog)
    if (data.drop?.full)              notify.bagFull()
    if (data.tacticDrop?.tactic_catalog) notify.tacticDrop(data.tacticDrop.tactic_catalog)
    triggerResourceFlash()
    setExpedition(null)
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
  const heroHpNow  = interpolateHp(hero, Date.now())

  return (
    <div className="dungeons-section">
      {/* Reward modal */}
      {reward && createPortal(
        <RewardModal reward={reward} onClose={() => setReward(null)} />,
        document.body
      )}

      {/* Pociones pre-expedición */}
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

      {/* Filter bar */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        {[...FILTERS_BASE, ...(lockedCount > 0 ? [{ id: 'locked', label: 'Bloqueadas', icon: Lock }] : [])].map(f => {
          const active = filter === f.id
          const FIcon = f.icon
          const badge = f.id === 'locked' ? lockedCount : null
          return (
            <button
              key={f.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap border transition-colors
                ${active
                  ? 'bg-[color-mix(in_srgb,var(--blue-500)_12%,var(--surface))] border-[var(--blue-300)] text-[var(--blue-600)]'
                  : 'bg-surface border-border text-text-3 hover:text-text-2 hover:border-border-2'
                }`}
              onClick={() => setFilter(f.id)}
            >
              <FIcon size={14} strokeWidth={2} />
              {f.label}
              {badge != null && (
                <span className="text-[11px] bg-text-3/15 text-text-3 rounded-full px-1.5 py-0 font-bold leading-[18px]">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-text-3 text-[14px] p-8 text-center">
          {filter === 'recommended'
            ? 'No hay mazmorras recomendadas para tu nivel actual.'
            : filter === 'materials'
              ? 'No hay mazmorras de materiales disponibles para tu nivel.'
              : filter === 'locked'
                ? 'Todas las mazmorras están desbloqueadas.'
                : 'No se encontraron mazmorras.'}
        </div>
      )}

      {/* Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
        variants={listVariants}
        initial="initial"
        animate="animate"
        key={filter}
      >
        {filtered.map(dungeon => (
          <motion.div key={dungeon.id} variants={cardVariants}>
            <DungeonCard
              dungeon={dungeon}
              heroLevel={heroLevel}
              heroStatus={heroStatus}
              onStart={handleStart}
              expedition={expedition}
              onCollect={handleCollect}
              heroHpNow={heroHpNow}
              heroMaxHp={hero?.max_hp ?? 100}
              agilityFactor={agilityFactor}
              atkMultiplier={atkMultiplier}
              heroStrength={hero?.strength ?? 0}
              heroDefense={hero?.defense ?? 0}
              heroIntelligence={hero?.intelligence ?? 0}
              weeklyModifier={weeklyModifier}
              equipHealth={equipHealth}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

export default Dungeons
