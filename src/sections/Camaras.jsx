import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Star, Clock, Heart, X, Layers, Package, Sword, Shield } from 'lucide-react'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useActiveChamber } from '../hooks/useActiveChamber'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import {
  CHAMBER_TYPES,
  CHAMBER_CHEST_REWARDS,
  CHAMBER_ITEM_KIND,
  CHAMBER_FRAGMENT_MIN_DIFFICULTY,
  chamberBaseReward,
  chamberDifficultyForLevel,
  chamberHpCost,
} from '../lib/gameConstants'

const RARITY_COLORS = {
  common: '#6b7280', uncommon: '#16a34a', rare: '#2563eb', epic: '#7c3aed', legendary: '#d97706',
}

const RARITY_LABELS = {
  common: 'Común', uncommon: 'Poco común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario',
}

function fmtTime(seconds) {
  if (seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

/* ─── Card de tipo de cámara — modos: idle / in-progress / ready ─────────── */

function ChamberTypeCard({
  type, cfg, onStart, onCollect, disabled, collecting,
  hpCost, currentHp, activeChamber, otherActive, difficulty,
}) {
  const enoughHp = currentHp > hpCost
  const reward = CHAMBER_CHEST_REWARDS[type]
  const base   = chamberBaseReward(difficulty)
  const goldShown = Math.round(base.gold * reward.goldMult)
  const xpShown   = Math.round(base.xp   * reward.xpMult)
  const fragmentsAllowed = difficulty >= CHAMBER_FRAGMENT_MIN_DIFFICULTY
  const itemPct = Math.round(reward.itemChance * 100)
  const fragPct = Math.round(reward.fragmentChance * 100)

  // Tick global de "now" — derivamos secondsLeft de él para que el primer
  // render ya tenga el valor correcto (evita el flicker 0→100 al entrar a la
  // vista cuando la cámara ya estaba terminada).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!activeChamber) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [activeChamber])

  const secondsLeft = activeChamber
    ? Math.max(0, Math.floor((new Date(activeChamber.ends_at) - now) / 1000))
    : null

  const ready = !!activeChamber && (secondsLeft === 0 || activeChamber.status === 'awaiting_choice')
  const inProgress = !!activeChamber && !ready

  let pct = 0
  if (activeChamber) {
    const totalSeconds = Math.max(1, Math.round((new Date(activeChamber.ends_at) - new Date(activeChamber.started_at)) / 1000))
    const elapsed = totalSeconds - (secondsLeft ?? totalSeconds)
    pct = Math.min(100, Math.round((elapsed / totalSeconds) * 100))
  }

  const borderColor = ready ? '#16a34a' : inProgress ? cfg.color : 'var(--border)'

  return (
    <motion.div
      className="bg-surface border rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden flex flex-col"
      style={{ borderColor, borderWidth: activeChamber ? 2 : 1 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.22 } }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-border"
        style={{ background: `color-mix(in srgb, ${cfg.color} 8%, var(--surface))` }}
      >
        <span className="text-[28px] leading-none select-none">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-extrabold text-text leading-tight truncate">{cfg.label}</p>
          <p className="text-[13px] text-text-3 mt-0.5">{cfg.minMinutes}-{cfg.maxMinutes} minutos</p>
        </div>
      </div>

      {/* Barra de progreso solo cuando hay cámara activa de este tipo */}
      {activeChamber && (
        <div className="h-2 bg-[var(--bg)]">
          <div
            className="h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%`, background: ready ? '#16a34a' : cfg.color }}
          />
        </div>
      )}

      <div className="px-4 py-3 flex-1 flex flex-col gap-2.5">
        {inProgress ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-text-3">
              <Clock size={12} strokeWidth={2.5} />
              Tiempo restante
            </div>
            <div
              className="text-[38px] font-extrabold tabular-nums leading-none"
              style={{ color: cfg.color }}
            >
              {fmtTime(secondsLeft ?? 0)}
            </div>
            <div className="text-[12px] text-text-3 mt-1 tabular-nums">
              {pct}% completado
            </div>
          </div>
        ) : ready ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-2">
            <Package size={32} strokeWidth={2} style={{ color: '#16a34a' }} />
            <div className="text-[16px] font-extrabold" style={{ color: '#16a34a' }}>
              ¡Cofres listos!
            </div>
            <div className="text-[12px] text-text-3">Elige 1 de 3 al recoger</div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[14px]" style={{ color: '#dc2626' }}>
              <Heart size={15} strokeWidth={2} className="flex-shrink-0" />
              <span className="font-semibold">−{hpCost} HP</span>
              <span className="text-text-3">({Math.round(cfg.hpCostPct * 100)}%)</span>
            </div>

            {/* Loot esperado por cofre — el jugador elige el mejor de 3 */}
            <div className="flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[color-mix(in_srgb,#d97706_10%,var(--bg))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] text-[13px] font-bold text-text">
                <Coins size={12} color="#d97706" strokeWidth={2.4} />{goldShown}
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[color-mix(in_srgb,#0369a1_10%,var(--bg))] border border-[color-mix(in_srgb,#0369a1_25%,var(--border))] text-[13px] font-bold text-text">
                <Star size={12} color="#0369a1" strokeWidth={2.4} />{xpShown}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[13px] text-text-2">
              {type === 'cazador'
                ? <Sword size={14} strokeWidth={2} className="flex-shrink-0 text-text-3" />
                : <Shield size={14} strokeWidth={2} className="flex-shrink-0 text-text-3" />}
              <span><span className="font-bold">{itemPct}%</span> {CHAMBER_ITEM_KIND[type]}</span>
            </div>

            <div className="flex items-center gap-2 text-[13px] text-text-2">
              <Layers size={14} strokeWidth={2} className="flex-shrink-0 text-text-3" />
              {fragmentsAllowed ? (
                <span><span className="font-bold">{fragPct}%</span> Fragmentos ×{reward.fragmentMin}{reward.fragmentMax > reward.fragmentMin ? `–${reward.fragmentMax}` : ''}</span>
              ) : (
                <span className="text-text-3 italic">Fragmentos: requiere dif ≥ {CHAMBER_FRAGMENT_MIN_DIFFICULTY}</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[12px] text-text-3">
              <Package size={13} strokeWidth={2} className="flex-shrink-0" />
              <span>Eliges 1 de 3 cofres al recoger</span>
            </div>
          </>
        )}
      </div>

      <div className="px-4 pb-4 mt-auto">
        {ready ? (
          <button
            className="btn btn--primary btn--md w-full"
            onClick={onCollect}
            disabled={collecting}
          >
            {collecting ? 'Abriendo cofres...' : 'Recoger'}
          </button>
        ) : inProgress ? (
          <button className="btn btn--ghost btn--md w-full" disabled>
            En curso...
          </button>
        ) : (
          <button
            className="btn btn--primary btn--md w-full"
            onClick={() => onStart(type)}
            disabled={disabled || !enoughHp || otherActive}
            title={
              otherActive ? 'Ya hay una cámara activa'
              : !enoughHp ? 'HP insuficiente'
              : undefined
            }
          >
            {otherActive ? 'Bloqueada' : !enoughHp ? 'HP insuficiente' : 'Entrar'}
          </button>
        )}
      </div>
    </motion.div>
  )
}

/* ─── Modal de selección de cofre ────────────────────────────────────────── */

function ChestRewardPills({ chest }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {chest.gold > 0 && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#d97706_12%,var(--bg))] border border-[color-mix(in_srgb,#d97706_30%,var(--border))] text-[12px] font-bold text-text">
          <Coins size={11} color="#d97706" strokeWidth={2.4} />{chest.gold}
        </span>
      )}
      {chest.xp > 0 && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#0369a1_12%,var(--bg))] border border-[color-mix(in_srgb,#0369a1_30%,var(--border))] text-[12px] font-bold text-text">
          <Star size={11} color="#0369a1" strokeWidth={2.4} />{chest.xp}
        </span>
      )}
      {chest.material && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#b45309_12%,var(--bg))] border border-[color-mix(in_srgb,#b45309_30%,var(--border))] text-[12px] font-bold text-text">
          <Layers size={11} color="#b45309" strokeWidth={2.4} />Fragmentos ×{chest.material.qty}
        </span>
      )}
      {chest.itemHint && (
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-bold"
          style={{
            background: `color-mix(in srgb, ${RARITY_COLORS[chest.itemHint.rarity]} 14%, var(--bg))`,
            border: `1px solid color-mix(in srgb, ${RARITY_COLORS[chest.itemHint.rarity]} 35%, var(--border))`,
            color: RARITY_COLORS[chest.itemHint.rarity],
          }}
        >
          ⚔ {RARITY_LABELS[chest.itemHint.rarity]}
        </span>
      )}
      {!chest.material && !chest.itemHint && chest.gold === 0 && chest.xp === 0 && (
        <span className="text-[12px] text-text-3 italic">Vacío</span>
      )}
    </div>
  )
}

function ChestChoice({ chest, index }) {
  const cfg = CHAMBER_CHEST_REWARDS[chest.archetype]

  if (chest.mystery) {
    return (
      <div className="flex flex-col gap-2.5 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="relative text-[28px] leading-none select-none grayscale opacity-70">
            {cfg.icon}
            <span className="absolute -top-1 -right-3 text-[20px]">❓</span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-extrabold leading-tight text-text">
              Cofre #{index + 1} · misterioso
            </p>
            <p className="text-[11px] text-text-3 leading-tight">Su contenido es un secreto</p>
          </div>
        </div>
        <p className="text-[12px] text-text-3 italic px-1 leading-snug">
          Puede ser excelente o decepcionante. Más arriesgado que los visibles.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="text-[28px] leading-none select-none">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold leading-tight" style={{ color: cfg.color }}>
            Cofre #{index + 1}
          </p>
          <p className="text-[11px] text-text-3 leading-tight">{cfg.description}</p>
        </div>
      </div>
      <ChestRewardPills chest={chest} />
    </div>
  )
}

/* Vista de revelado para cuando el jugador elige el cofre misterioso */
function MysteryRevealView({ chest, index }) {
  const cfg = CHAMBER_CHEST_REWARDS[chest.archetype]
  return (
    <motion.div
      key="reveal"
      className="flex flex-col items-center gap-4 px-6 py-8"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <motion.div
        className="text-[56px] leading-none select-none"
        initial={{ rotate: -10, scale: 0.5 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
      >
        {cfg.icon}
      </motion.div>
      <div className="text-center">
        <p className="text-[18px] font-extrabold text-text leading-tight">
          ¡Cofre misterioso revelado!
        </p>
        <p className="text-[12px] text-text-3 mt-1">Cofre #{index + 1}</p>
      </div>
      <motion.div
        className="flex justify-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <ChestRewardPills chest={chest} />
      </motion.div>
    </motion.div>
  )
}

function ChestPickerModal({ chests, onPick, picking, onClose, revealedChest, revealedIndex }) {
  const isRevealing = revealedChest != null
  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
    >
      <motion.div
        className="relative bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-md flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {isRevealing ? (
          <MysteryRevealView chest={revealedChest} index={revealedIndex} />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
              <div>
                <p className="text-[18px] font-extrabold text-text leading-tight">Elige un cofre</p>
                <p className="text-[12px] text-text-3 mt-0.5">Solo puedes quedarte con uno. Los otros dos se pierden.</p>
              </div>
              <button
                className="btn btn--ghost btn--icon flex-shrink-0"
                onClick={onClose}
                disabled={picking}
                title="Cerrar"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="flex flex-col gap-2 p-3 max-h-[60vh] overflow-y-auto">
              {chests.map((chest, idx) => {
                const cfg = CHAMBER_CHEST_REWARDS[chest.archetype]
                const accentColor = chest.mystery ? '#6b7280' : cfg.color
                return (
                  <button
                    key={idx}
                    onClick={() => !picking && onPick(idx)}
                    disabled={picking}
                    className="text-left rounded-xl border-2 transition-[transform,background] disabled:opacity-50 hover:-translate-y-0.5"
                    style={{
                      borderColor: `color-mix(in srgb, ${accentColor} 50%, var(--border))`,
                      background: `color-mix(in srgb, ${accentColor} 4%, var(--surface))`,
                      borderStyle: chest.mystery ? 'dashed' : 'solid',
                    }}
                  >
                    <ChestChoice chest={chest} index={idx} />
                  </button>
                )
              })}
            </div>

            {picking && (
              <div className="px-5 py-3 text-center text-[12px] text-text-3 border-t border-border">
                Aplicando recompensa...
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>,
    document.body,
  )
}

/* ─── Sección principal ──────────────────────────────────────────────────── */

export default function Camaras() {
  const heroId = useHeroId()
  const queryClient = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { chamber, loading: chamberLoading, setChamber } = useActiveChamber(heroId)

  const [pickerChests, setPickerChests] = useState(null)
  const [pickerToken,  setPickerToken]  = useState(null)
  const [revealedChest, setRevealedChest] = useState(null)
  const [revealedIndex, setRevealedIndex] = useState(null)

  const startMutation = useMutation({
    mutationFn: (chamberType) => apiPost('/api/chamber-start', { heroId, chamberType }),
    onSuccess: (data) => {
      setChamber(data.run)
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(hero?.player_id) })
    },
    onError: (err) => notify.error(err.message),
  })

  const collectMutation = useMutation({
    mutationFn: () => apiPost('/api/chamber-collect', { runId: chamber.id }),
    onSuccess: (data) => {
      setPickerChests(data.chests)
      setPickerToken(data.token)
    },
    onError: (err) => notify.error(err.message),
  })

  const confirmMutation = useMutation({
    mutationFn: (chosenIndex) => apiPost('/api/chamber-confirm', { token: pickerToken, chosenIndex }),
    onSuccess: (_data, chosenIndex) => {
      // Refrescar cámara, recursos, héroe e inventario inmediatamente.
      // Sin toasts: el feedback visual es el reveal (si era misterioso) o
      // el cierre del modal (si era visible).
      setChamber(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(hero?.player_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(hero?.player_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })

      // Si fue un cofre misterioso ya estamos mostrando el reveal — lo dejamos
      // visible 2.5s antes de cerrar el modal. Si fue un visible, cierre directo.
      const wasMystery = pickerChests?.[chosenIndex]?.mystery === true
      const delayMs = wasMystery ? 2500 : 0
      setTimeout(() => {
        setPickerChests(null)
        setPickerToken(null)
        setRevealedChest(null)
        setRevealedIndex(null)
      }, delayMs)
    },
    onError: (err) => {
      // Revertir el reveal si la mutación falló
      setRevealedChest(null)
      setRevealedIndex(null)
      notify.error(err.message)
    },
  })

  function handlePickChest(idx) {
    if (confirmMutation.isPending) return
    const chest = pickerChests?.[idx]
    if (chest?.mystery) {
      setRevealedChest(chest)
      setRevealedIndex(idx)
    }
    confirmMutation.mutate(idx)
  }

  if (heroLoading || chamberLoading || !hero) {
    return <div className="text-text-3 text-[15px] p-10 text-center">Cargando cámaras...</div>
  }

  // HP actual interpolado y dificultad para previews de loot
  const currentHp = interpolateHp(hero, Date.now())
  const difficulty = chamberDifficultyForLevel(hero.level)

  return (
    <div className="flex flex-col gap-5">
      {/* Hero info */}
      <div className="flex items-start gap-3 px-1">
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-extrabold text-text leading-tight">Cámaras</h1>
          <p className="text-[13px] text-text-3 mt-1 max-w-xl">
            Incursiones rápidas con coste alto de HP. Al recoger eliges <span className="font-semibold text-text-2">1 de 3 cofres</span> y los demás se pierden. Complementan a las expediciones — no las reemplazan.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[color-mix(in_srgb,#dc2626_10%,var(--surface))] border border-[color-mix(in_srgb,#dc2626_30%,var(--border))] flex-shrink-0">
          <Heart size={13} color="#dc2626" strokeWidth={2.4} />
          <span className="text-[12px] font-bold text-text tabular-nums">{currentHp}/{hero.max_hp}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(CHAMBER_TYPES).map(([type, cfg]) => {
          const isThisActive = chamber?.chamber_type === type
          return (
            <ChamberTypeCard
              key={type}
              type={type}
              cfg={cfg}
              hpCost={chamberHpCost(type, hero.max_hp)}
              currentHp={currentHp}
              difficulty={difficulty}
              activeChamber={isThisActive ? chamber : null}
              otherActive={!!chamber && !isThisActive}
              onStart={(t) => startMutation.mutate(t)}
              onCollect={() => collectMutation.mutate()}
              disabled={startMutation.isPending}
              collecting={collectMutation.isPending}
            />
          )
        })}
      </div>

      <AnimatePresence>
        {pickerChests && (
          <ChestPickerModal
            chests={pickerChests}
            picking={confirmMutation.isPending}
            revealedChest={revealedChest}
            revealedIndex={revealedIndex}
            onPick={handlePickChest}
            onClose={() => {
              if (confirmMutation.isPending) return
              setPickerChests(null)
              setPickerToken(null)
              setRevealedChest(null)
              setRevealedIndex(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
