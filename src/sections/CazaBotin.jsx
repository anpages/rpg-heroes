import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Coins, Clock, Heart, X, Package, Target, RefreshCw, Sparkles, Layers,
} from 'lucide-react'
import { notify } from '../lib/notifications'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useResources } from '../hooks/useResources'
import { useBountyState } from '../hooks/useBountyState'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import {
  BOUNTY_ROUTES_CATALOG,
  BOUNTY_COST,
  BOUNTY_DURATION_MIN,
  BOUNTY_SUCCESS_RATE,
  BOUNTY_CONSOLATION_FRAGMENTS,
  BOUNTY_REGEN_MAX,
  bountyHpCost,
  bountyRegenCost,
  bountyRarityWeightsForLevel,
} from '../lib/gameConstants'

const RARITY_COLORS = {
  common: '#6b7280', uncommon: '#16a34a', rare: '#2563eb', epic: '#7c3aed', legendary: '#d97706',
}
const RARITY_LABELS = {
  common: 'Común', uncommon: 'Poco común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario',
}
const SLOT_LABELS = {
  main_hand: 'Arma principal', off_hand: 'Arma secundaria',
  helmet: 'Casco', chest: 'Pechera', arms: 'Brazos', legs: 'Piernas', feet: 'Botas',
  accessory: 'Accesorio',
}

const ROUTES_BY_KEY = Object.fromEntries(BOUNTY_ROUTES_CATALOG.map(r => [r.key, r]))

function fmtTime(seconds) {
  if (seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

function fmtResetCountdown(ms) {
  if (ms <= 0) return 'ya disponible'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/* ─── Tarjeta de ruta ────────────────────────────────────────────────────── */

function RouteCard({
  route, routeMeta, onStart, disabled, canStart, disabledReason, activeRun, onConfirm, confirming,
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!activeRun) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [activeRun])

  const secondsLeft = activeRun
    ? Math.max(0, Math.floor((new Date(activeRun.ends_at) - now) / 1000))
    : null
  const ready      = !!activeRun && secondsLeft === 0
  const inProgress = !!activeRun && !ready

  let pct = 0
  if (activeRun) {
    const total = Math.max(1, Math.round((new Date(activeRun.ends_at) - new Date(activeRun.started_at)) / 1000))
    const elapsed = total - (secondsLeft ?? total)
    pct = Math.min(100, Math.round((elapsed / total) * 100))
  }

  const used = !!route.used && !activeRun
  const borderColor = ready ? '#16a34a' : inProgress ? '#7c3aed' : used ? 'var(--border)' : 'var(--border)'

  return (
    <motion.div
      className="bg-surface border rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden flex flex-col"
      style={{ borderColor, borderWidth: activeRun ? 2 : 1, opacity: used ? 0.55 : 1 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: used ? 0.55 : 1, y: 0, transition: { duration: 0.22 } }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-border"
        style={{ background: 'color-mix(in srgb, #7c3aed 6%, var(--surface))' }}
      >
        <span className="text-[28px] leading-none select-none">{routeMeta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-extrabold text-text leading-tight truncate">{routeMeta.label}</p>
          <p className="text-[13px] text-text-3 mt-0.5">{SLOT_LABELS[route.slot] ?? route.slot}</p>
        </div>
      </div>

      {activeRun && (
        <div className="h-2 bg-[var(--bg)]">
          <div
            className="h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%`, background: ready ? '#16a34a' : '#7c3aed' }}
          />
        </div>
      )}

      <div className="px-4 py-3 flex-1 flex flex-col gap-2.5">
        {inProgress ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-text-3">
              <Clock size={12} strokeWidth={2.5} />
              Rastreando
            </div>
            <div className="text-[38px] font-extrabold tabular-nums leading-none" style={{ color: '#7c3aed' }}>
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
              ¡Listo para revelar!
            </div>
            <div className="text-[12px] text-text-3 text-center">
              Tirada {Math.round(BOUNTY_SUCCESS_RATE * 100)}% éxito
            </div>
          </div>
        ) : used ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-2">
            <Target size={28} strokeWidth={2} className="text-text-3" />
            <div className="text-[14px] font-bold text-text-3">Agotada</div>
            <div className="text-[11px] text-text-3 text-center px-1">
              Espera al reset o regenera el pool
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[13px]" style={{ color: '#dc2626' }}>
              <Heart size={14} strokeWidth={2} />
              <span className="font-semibold">−{routeMeta.hpCost} HP</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[color-mix(in_srgb,#d97706_10%,var(--bg))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] text-[12px] font-bold text-text">
                <Coins size={11} color="#d97706" strokeWidth={2.4} />{BOUNTY_COST.gold}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-text-3">
              <Clock size={12} strokeWidth={2} />
              <span>{BOUNTY_DURATION_MIN} min</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-text-3">
              <Target size={12} strokeWidth={2} />
              <span>{Math.round(BOUNTY_SUCCESS_RATE * 100)}% de encontrar {SLOT_LABELS[route.slot]?.toLowerCase()}</span>
            </div>
          </>
        )}
      </div>

      <div className="px-4 pb-4 mt-auto">
        {ready ? (
          <button
            className="btn btn--primary btn--md w-full"
            onClick={() => onConfirm(activeRun.id)}
            disabled={confirming}
          >
            {confirming ? 'Revelando...' : 'Revelar'}
          </button>
        ) : inProgress ? (
          <button className="btn btn--ghost btn--md w-full" disabled>
            En curso...
          </button>
        ) : used ? (
          <button className="btn btn--ghost btn--md w-full" disabled>
            Agotada
          </button>
        ) : (
          <button
            className="btn btn--primary btn--md w-full"
            onClick={() => onStart(route.key)}
            disabled={disabled || !canStart}
            title={disabledReason}
          >
            {canStart ? 'Cazar' : disabledReason ?? 'No disponible'}
          </button>
        )}
      </div>
    </motion.div>
  )
}

/* ─── Modal de resultado ─────────────────────────────────────────────────── */

function ResultModal({ result, onClose }) {
  if (!result) return null
  const { success, rarity, drop, fragments, slot } = result
  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
    >
      <motion.div
        className="relative bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-sm flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <p className="text-[18px] font-extrabold text-text leading-tight">
              {success ? '¡Botín conseguido!' : 'Sin suerte'}
            </p>
            <p className="text-[12px] text-text-3 mt-0.5">
              {success ? 'La ruta dio sus frutos' : 'La pista se enfrió'}
            </p>
          </div>
          <button className="btn btn--ghost btn--icon flex-shrink-0" onClick={onClose} title="Cerrar">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 px-6 py-6">
          {success && drop ? (
            <>
              <motion.div
                className="text-[56px] leading-none select-none"
                initial={{ rotate: -10, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
              >
                <Sparkles size={56} color={RARITY_COLORS[rarity]} strokeWidth={2} />
              </motion.div>
              <div className="text-center">
                <p className="text-[18px] font-extrabold text-text leading-tight">
                  {drop.item_catalog?.name ?? 'Nuevo ítem'}
                </p>
                <p
                  className="text-[13px] font-bold mt-1"
                  style={{ color: RARITY_COLORS[rarity] }}
                >
                  {RARITY_LABELS[rarity]} · {SLOT_LABELS[slot] ?? slot}
                </p>
              </div>
            </>
          ) : (
            <>
              <Layers size={56} color="#b45309" strokeWidth={2} />
              <div className="text-center">
                <p className="text-[16px] font-bold text-text">No había rastro hoy</p>
                <p className="text-[13px] text-text-3 mt-1">
                  Recuperaste <span className="font-extrabold text-text">{fragments}</span> fragmentos
                </p>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border">
          <button className="btn btn--primary btn--md w-full" onClick={onClose}>
            Continuar
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}

/* ─── Sección principal ──────────────────────────────────────────────────── */

export default function CazaBotin() {
  const heroId = useHeroId()
  const queryClient = useQueryClient()
  const { hero, loading: heroLoading } = useHero(heroId)
  const { resources } = useResources(hero?.player_id)
  const { routes, resetAt, regensToday, activeRun, loading: stateLoading, refetch } = useBountyState(heroId)

  const [result, setResult] = useState(null)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const currentHp = hero ? interpolateHp(hero, now) : 0
  const hpCost    = hero ? bountyHpCost(hero.max_hp) : 0
  const rarityWeights = hero ? bountyRarityWeightsForLevel(hero.level) : null

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bountyState(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.heroes(hero?.player_id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.resources(hero?.player_id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
  }

  const startMutation = useMutation({
    mutationFn: (routeKey) => apiPost('/api/bounty-start', { heroId, routeKey }),
    onSuccess: () => {
      invalidateAll()
      refetch()
    },
    onError: (err) => notify.error(err.message),
  })

  const confirmMutation = useMutation({
    mutationFn: (runId) => apiPost('/api/bounty-confirm', { runId }),
    onSuccess: (data) => {
      setResult(data)
      invalidateAll()
      refetch()
    },
    onError: (err) => notify.error(err.message),
  })

  const regenMutation = useMutation({
    mutationFn: () => apiPost('/api/bounty-regenerate', { heroId }),
    onSuccess: () => {
      invalidateAll()
      refetch()
    },
    onError: (err) => notify.error(err.message),
  })

  const canAffordRoute = useMemo(() => {
    if (!resources) return false
    return resources.gold >= BOUNTY_COST.gold
  }, [resources])

  const regenCost   = bountyRegenCost(regensToday)
  const canRegen    = regenCost != null && (resources?.gold ?? 0) >= regenCost

  if (heroLoading || stateLoading || !hero) {
    return <div className="text-text-3 text-[15px] p-10 text-center">Cargando rutas...</div>
  }

  const resetMs = resetAt ? new Date(resetAt).getTime() - now : 0

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-3 px-1">
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-extrabold text-text leading-tight">Caza de Botín</h1>
          <p className="text-[13px] text-text-3 mt-1 max-w-xl">
            Rastrea pistas para encontrar piezas concretas de equipo. Cada día hay {routes.length} rutas disponibles y 1 intento por ruta.{' '}
            <span className="font-semibold text-text-2">La tirada es al {Math.round(BOUNTY_SUCCESS_RATE * 100)}% — arriesgas recursos por dirigir el resultado.</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[color-mix(in_srgb,#dc2626_10%,var(--surface))] border border-[color-mix(in_srgb,#dc2626_30%,var(--border))] flex-shrink-0">
          <Heart size={13} color="#dc2626" strokeWidth={2.4} />
          <span className="text-[12px] font-bold text-text tabular-nums">{currentHp}/{hero.max_hp}</span>
        </div>
      </div>

      {/* Info bar: reset + regenerar */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between px-3 py-2 rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 text-[13px] text-text-2">
          <Clock size={14} strokeWidth={2} className="text-text-3" />
          <span>
            Siguiente reset en <span className="font-bold text-text">{fmtResetCountdown(resetMs)}</span>
          </span>
          <span className="text-text-3">·</span>
          <span className="text-text-3">
            Regens {regensToday}/{BOUNTY_REGEN_MAX}
          </span>
        </div>
        <button
          className="btn btn--secondary btn--sm"
          onClick={() => regenMutation.mutate()}
          disabled={regenMutation.isPending || regenCost == null || !canRegen}
          title={
            regenCost == null ? 'Máximo de regeneraciones alcanzado'
            : !canRegen      ? `Oro insuficiente (necesitas ${regenCost})`
            : undefined
          }
        >
          <RefreshCw size={14} strokeWidth={2.4} />
          {regenCost == null
            ? 'Agotado'
            : `Regenerar · ${regenCost} oro`}
        </button>
      </div>

      {/* Rutas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {routes.map((route) => {
          const routeMeta = ROUTES_BY_KEY[route.key]
          if (!routeMeta) return null

          const isThisActive = activeRun?.route_key === route.key
          const enoughHp = currentHp > hpCost
          const heroBusy = hero.status !== 'idle' && !isThisActive
          const canStart = !route.used && canAffordRoute && enoughHp && !heroBusy
          const disabledReason =
            route.used     ? 'Agotada'
            : heroBusy     ? 'Héroe ocupado'
            : !enoughHp    ? 'HP insuficiente'
            : !canAffordRoute ? 'Recursos insuficientes'
            : undefined

          return (
            <RouteCard
              key={route.key}
              route={route}
              routeMeta={{ ...routeMeta, hpCost }}
              activeRun={isThisActive ? activeRun : null}
              onStart={(key) => startMutation.mutate(key)}
              onConfirm={(runId) => confirmMutation.mutate(runId)}
              confirming={confirmMutation.isPending}
              disabled={startMutation.isPending}
              canStart={canStart}
              disabledReason={disabledReason}
            />
          )
        })}
      </div>

      {/* Distribución de rareza según nivel */}
      {rarityWeights && (
        <div className="px-3 py-3 rounded-xl border border-border bg-surface">
          <p className="text-[12px] uppercase tracking-wider font-bold text-text-3 mb-2">
            Distribución de rareza (nivel {hero.level})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(rarityWeights).map(([rar, pct]) => (
              pct > 0 && (
                <span
                  key={rar}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-bold"
                  style={{
                    background: `color-mix(in srgb, ${RARITY_COLORS[rar]} 12%, var(--bg))`,
                    border: `1px solid color-mix(in srgb, ${RARITY_COLORS[rar]} 30%, var(--border))`,
                    color: RARITY_COLORS[rar],
                  }}
                >
                  {RARITY_LABELS[rar]} {pct}%
                </span>
              )
            ))}
          </div>
          <p className="text-[11px] text-text-3 mt-2">
            Al fallar recibes {BOUNTY_CONSOLATION_FRAGMENTS.min}–{BOUNTY_CONSOLATION_FRAGMENTS.max} fragmentos.
          </p>
        </div>
      )}

      <AnimatePresence>
        {result && <ResultModal result={result} onClose={() => setResult(null)} />}
      </AnimatePresence>
    </div>
  )
}
