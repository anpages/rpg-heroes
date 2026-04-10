import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Star, Clock, Zap, Heart, X, Layers, Sparkles, Package } from 'lucide-react'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useActiveChamber } from '../hooks/useActiveChamber'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { showItemDropToast, showCardDropToast } from '../lib/dropToast'
import {
  CHAMBER_TYPES,
  CHAMBER_HP_COST_PCT,
  CHAMBER_CHEST_REWARDS,
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
  hpCost, currentHp, activeChamber, otherActive,
}) {
  const enoughHp = currentHp > hpCost

  const [secondsLeft, setSecondsLeft] = useState(null)
  useEffect(() => {
    if (!activeChamber) { setSecondsLeft(null); return }
    function tick() {
      const remaining = Math.max(0, Math.floor((new Date(activeChamber.ends_at) - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeChamber])

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
          <p className="text-[15px] font-extrabold text-text leading-tight truncate">{cfg.label}</p>
          <p className="text-[11px] text-text-3 mt-0.5">{cfg.minMinutes}-{cfg.maxMinutes} minutos</p>
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

      <div className="px-4 py-3 flex flex-col gap-2.5">
        {inProgress ? (
          <div className="flex items-center gap-2 text-[12px] text-text-2">
            <Clock size={13} strokeWidth={2} className="text-text-3 flex-shrink-0" />
            <span className="font-semibold tabular-nums">{fmtTime(secondsLeft ?? 0)}</span>
            <span className="text-text-3">restante</span>
          </div>
        ) : ready ? (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: '#16a34a' }}>
            <Package size={13} strokeWidth={2} className="flex-shrink-0" />
            <span className="font-semibold">¡Cofres listos para abrir!</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[12px] text-text-2">
              <Clock size={13} strokeWidth={2} className="text-text-3 flex-shrink-0" />
              Sortea duración entre {cfg.minMinutes} y {cfg.maxMinutes} min
            </div>
            <div className="flex items-center gap-2 text-[12px]" style={{ color: '#dc2626' }}>
              <Heart size={13} strokeWidth={2} className="flex-shrink-0" />
              <span className="font-semibold">−{hpCost} HP</span>
              <span className="text-text-3">({Math.round(CHAMBER_HP_COST_PCT * 100)}% del máximo)</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-text-3">
              <Package size={13} strokeWidth={2} className="flex-shrink-0" />
              Al recoger eliges 1 de 3 cofres
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

function ChestChoice({ chest }) {
  const cfg = CHAMBER_CHEST_REWARDS[chest.archetype]
  return (
    <div className="flex flex-col gap-2.5 px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="text-[28px] leading-none select-none">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold leading-tight" style={{ color: cfg.color }}>
            {cfg.label}
          </p>
          <p className="text-[10px] text-text-3 leading-tight">{cfg.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-1">
        {chest.gold > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#d97706_12%,var(--bg))] border border-[color-mix(in_srgb,#d97706_30%,var(--border))] text-[11px] font-bold text-text">
            <Coins size={10} color="#d97706" strokeWidth={2.4} />{chest.gold}
          </span>
        )}
        {chest.xp > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#0369a1_12%,var(--bg))] border border-[color-mix(in_srgb,#0369a1_30%,var(--border))] text-[11px] font-bold text-text">
            <Star size={10} color="#0369a1" strokeWidth={2.4} />{chest.xp}
          </span>
        )}
        {chest.material && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,#b45309_12%,var(--bg))] border border-[color-mix(in_srgb,#b45309_30%,var(--border))] text-[11px] font-bold text-text">
            <Layers size={10} color="#b45309" strokeWidth={2.4} />×{chest.material.qty}
          </span>
        )}
        {chest.itemHint && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{
              background: `color-mix(in srgb, ${RARITY_COLORS[chest.itemHint.rarity]} 14%, var(--bg))`,
              border: `1px solid color-mix(in srgb, ${RARITY_COLORS[chest.itemHint.rarity]} 35%, var(--border))`,
              color: RARITY_COLORS[chest.itemHint.rarity],
            }}
          >
            ⚔ {RARITY_LABELS[chest.itemHint.rarity]}
          </span>
        )}
        {chest.cardHint && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{
              background: `color-mix(in srgb, ${RARITY_COLORS[chest.cardHint.rarity]} 14%, var(--bg))`,
              border: `1px solid color-mix(in srgb, ${RARITY_COLORS[chest.cardHint.rarity]} 35%, var(--border))`,
              color: RARITY_COLORS[chest.cardHint.rarity],
            }}
          >
            🃏 {RARITY_LABELS[chest.cardHint.rarity]}
          </span>
        )}
        {!chest.material && !chest.itemHint && !chest.cardHint && chest.gold === 0 && chest.xp === 0 && (
          <span className="text-[11px] text-text-3 italic">Vacío</span>
        )}
      </div>
    </div>
  )
}

function ChestPickerModal({ chests, onPick, picking, onClose }) {
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
          {chests.map(chest => {
            const cfg = CHAMBER_CHEST_REWARDS[chest.archetype]
            return (
              <button
                key={chest.archetype}
                onClick={() => !picking && onPick(chest.archetype)}
                disabled={picking}
                className="text-left rounded-xl border-2 transition-[transform,background] disabled:opacity-50 hover:-translate-y-0.5"
                style={{
                  borderColor: `color-mix(in srgb, ${cfg.color} 50%, var(--border))`,
                  background: `color-mix(in srgb, ${cfg.color} 4%, var(--surface))`,
                }}
              >
                <ChestChoice chest={chest} />
              </button>
            )
          })}
        </div>

        {picking && (
          <div className="px-5 py-3 text-center text-[12px] text-text-3 border-t border-border">
            Aplicando recompensa...
          </div>
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

  const startMutation = useMutation({
    mutationFn: (chamberType) => apiPost('/api/chamber-start', { heroId, chamberType }),
    onSuccess: (data) => {
      setChamber(data.run)
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(hero?.player_id) })
      toast.success('¡Cámara iniciada!', { description: `Coste: ${data.hpCost} HP` })
    },
    onError: (err) => toast.error(err.message),
  })

  const collectMutation = useMutation({
    mutationFn: () => apiPost('/api/chamber-collect', { runId: chamber.id }),
    onSuccess: (data) => {
      setPickerChests(data.chests)
      setPickerToken(data.token)
    },
    onError: (err) => toast.error(err.message),
  })

  const confirmMutation = useMutation({
    mutationFn: (chosen) => apiPost('/api/chamber-confirm', { token: pickerToken, chosen }),
    onSuccess: (data) => {
      // Limpiar la cámara activa de la caché para que vuelva al listado
      setChamber(null)
      setPickerChests(null)
      setPickerToken(null)

      // Refrescar recursos, héroe e inventario
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(hero?.player_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(hero?.player_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.heroCards(heroId) })

      toast.success(`¡Cámara completada!`, {
        description: `+${data.rewards.gold} oro · +${data.rewards.experience} XP`,
      })
      if (data.levelUp) toast(`⚡ ¡Nivel ${(hero?.level ?? 0) + 1}!`, { duration: 6000 })
      if (data.drop)     showItemDropToast(data.drop.item_catalog)
      if (data.cardDrop) showCardDropToast(data.cardDrop.skill_cards)
    },
    onError: (err) => toast.error(err.message),
  })

  if (heroLoading || chamberLoading || !hero) {
    return <div className="text-text-3 text-[15px] p-10 text-center">Cargando cámaras...</div>
  }

  // HP actual interpolado para mostrar coste viable
  const currentHp = interpolateHp(hero, Date.now())
  const hpCost = Math.max(1, Math.round(hero.max_hp * CHAMBER_HP_COST_PCT))

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
              hpCost={hpCost}
              currentHp={currentHp}
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
            onPick={(archetype) => confirmMutation.mutate(archetype)}
            onClose={() => {
              if (confirmMutation.isPending) return
              setPickerChests(null)
              setPickerToken(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
