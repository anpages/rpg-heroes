import { useState, useEffect, useReducer, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHero } from '../hooks/useHero'
import { useHeroes } from '../hooks/useHeroes'
import { useInventory } from '../hooks/useInventory'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { trainingRewards } from '../lib/gameFormulas'
import { Swords, Heart, Coins, Star, Shield, Flame, Layers } from 'lucide-react'
import { CLASS_LABELS, CLASS_ICONS, CLASS_COLORS } from '../lib/gameConstants'
import { motion, AnimatePresence } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'
import RatingBanner from '../components/RatingBanner'
import { tierForRating } from '../lib/combatRating'
import { PotionPanel } from '../components/PotionPanel'
import { TacticsStrip } from '../components/TacticsStrip'
import { HeroCombatPicker } from '../components/HeroPicker'

/* ─── Countdown overlay (3…2…1 justo antes de combatir) ─────────────────────── */

function CountdownOverlay({ onReady }) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count <= 0) { onReady(); return }
    const id = setTimeout(() => setCount(c => c - 1), 700)
    return () => clearTimeout(id)
  }, [count, onReady])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex flex-col items-center gap-6 bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] px-14 py-12"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <Shield size={28} className="text-[#3b82f6]" strokeWidth={1.8} />
            <span className="text-[11px] font-bold text-[#93c5fd] uppercase tracking-wider">Tú</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={count}
              className="text-[64px] font-black text-text leading-none"
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.28 }}
            >
              {count > 0 ? count : '⚔️'}
            </motion.span>
          </AnimatePresence>
          <div className="flex flex-col items-center gap-1">
            <Flame size={28} className="text-[#dc2626]" strokeWidth={1.8} />
            <span className="text-[11px] font-bold text-[#fca5a5] uppercase tracking-wider">Rival</span>
          </div>
        </div>
        <p className="text-text-3 text-[13px] font-semibold">Preparando combate...</p>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function QuickCombat() {
  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const navigateToHeroTab    = useAppStore(s => s.navigateToHeroTab)
  const [heroId, setHeroId]  = useState(null)
  const queryClient          = useQueryClient()
  const { heroes }           = useHeroes(userId)
  const { hero }             = useHero(heroId)
  const { items }            = useInventory(heroId)
  const { catalog, inventory } = useCraftedItems(userId)
  const [preview, setPreview]             = useState(null)
  const [matchmaking, setMatchmaking]     = useState(false)
  const [pendingResult, setPendingResult] = useState(null)
  const [result, setResult]               = useState(null)
  const [waitingForApi, setWaitingForApi] = useState(false)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10_000)
    return () => clearInterval(id)
  }, [])

  const nowMs        = Date.now()
  const equipBonuses = (items ?? [])
    .filter(i => i.equipped_slot && i.current_durability > 0)
    .reduce((acc, i) => {
      const c = i.item_catalog
      acc.max_hp   += c.hp_bonus       ?? 0
      acc.attack   += c.attack_bonus   ?? 0
      acc.defense  += c.defense_bonus  ?? 0
      acc.strength += c.strength_bonus ?? 0
      acc.agility  += c.agility_bonus  ?? 0
      return acc
    }, { attack: 0, defense: 0, max_hp: 0, strength: 0, agility: 0 })

  const effectiveMaxHp = hero ? hero.max_hp + equipBonuses.max_hp : 100
  const hpNow          = interpolateHp(hero, nowMs, effectiveMaxHp)
  const hasEnoughHp    = hpNow >= Math.floor(effectiveMaxHp * 0.2)
  const isBusy         = hero?.status !== 'idle'
  const rewards        = trainingRewards(hero?.level ?? 1)

  const hpPotions = (catalog ?? [])
    .filter(c => c.effects?.some(e => e.type === 'hp_restore') && (inventory[c.id] ?? 0) > 0)
    .map(c => ({ ...c, quantity: inventory[c.id] ?? 0 }))

  const itemUseMutation = useMutation({
    mutationFn: async (recipeId) => {
      await apiPost('/api/item-use', { heroId: hero?.id, recipeId })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.craftedItems(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.hero(heroId) }),
      ])
    },
    onError: err => notify.error(err.message),
  })

  const previewMutation = useMutation({
    mutationFn: () => apiPost('/api/quick-combat-preview', {}),
    onSuccess:  (data) => setPreview(data),
    onError:    (err)  => notify.error(err.message),
  })

  const combatMutation = useMutation({
    mutationFn: () => apiPost('/api/quick-combat', { heroId, previewToken: preview?.token }),
    onSuccess:  (data) => setPendingResult(data),
    onError: (err) => {
      setMatchmaking(false)
      if (err.message.includes('INVALID_PREVIEW') || err.message.includes('Token')) {
        setPreview(null)
        setHeroId(null)
        notify.error('El rival ha expirado. Busca uno nuevo.')
      } else {
        notify.error(err.message)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
  })

  function startCombat() {
    setPendingResult(null)
    setMatchmaking(true)
    combatMutation.mutate()
  }

  function revealResult(data) {
    setMatchmaking(false)
    setResult(data)
    setPendingResult(null)
    setWaitingForApi(false)
  }

  function applyPostCombat(data) {
    if (!data) return
    if (data.won) {
      triggerResourceFlash()
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    if (data.durabilityLoss > 0) queryClient.invalidateQueries({ queryKey: queryKeys.inventory(heroId) })
  }

  useEffect(() => {
    if (waitingForApi && pendingResult) revealResult(pendingResult)
  }, [waitingForApi, pendingResult])

  const handleAnimationDone = useCallback(() => {
    if (pendingResult) revealResult(pendingResult)
    else setWaitingForApi(true)
  }, [pendingResult])

  const enemyClass = preview?.enemyClass ?? null
  const tier       = tierForRating(hero?.combat_rating ?? 0)
  const classColor = enemyClass ? (CLASS_COLORS[enemyClass] ?? 'var(--text-3)') : tier.color

  // Al menos un héroe debe estar disponible para buscar rival
  const anyHeroAvailable = (heroes ?? []).some(h => {
    const activeExp = h.expeditions?.find(e => e.status === 'traveling')
    if (activeExp && new Date(activeExp.ends_at) > new Date(nowMs)) return false
    return h.status === 'idle' || !!activeExp
  })

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Combate Rápido</h2>
        <p className="section-subtitle">Busca un rival, elige tu héroe y combate.</p>
      </div>

      <AnimatePresence>
        {matchmaking && <CountdownOverlay onReady={handleAnimationDone} />}
      </AnimatePresence>

      {result && (
        <CombatReplay
          heroName={hero?.name ?? 'Héroe'}
          enemyName={result.enemyName}
          heroMaxHp={result.heroMaxHp}
          enemyMaxHp={result.enemyMaxHp}
          log={result.log ?? []}
          won={result.won}
          rewards={result.rewards}
          rating={result.rating}
          heroClass={result.heroClass}
          archetype={result.archetype}
          enemyTactics={result.enemyTactics}
          onClose={() => {
            applyPostCombat(result)
            setResult(null)
            setPreview(null)
            setHeroId(null)
          }}
        />
      )}

      {/* Recompensas */}
      <div className="bg-surface border border-border rounded-xl px-5 py-4 flex flex-col gap-2 shadow-[var(--shadow-sm)]">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Recompensas al ganar</span>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
            <Coins size={13} color="#d97706" strokeWidth={2} />+{rewards.gold} oro
          </span>
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
            <Star size={13} color="#0369a1" strokeWidth={2} />+{rewards.experience} XP
          </span>
          <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#7c3aed]">
            <Layers size={13} color="#7c3aed" strokeWidth={2} />Táctica (8%)
          </span>
        </div>
      </div>

      {/* Rival */}
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 shadow-[var(--shadow-sm)]">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Rival</span>

        {!preview ? (
          <motion.button
            className="btn btn--primary btn--lg btn--full"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending || !anyHeroAvailable}
            whileTap={previewMutation.isPending || !anyHeroAvailable ? {} : { scale: 0.96 }}
          >
            {previewMutation.isPending ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                  className="inline-flex"
                >
                  <Swords size={16} strokeWidth={2} />
                </motion.span>
                Buscando rival...
              </>
            ) : (
              <>
                <Swords size={16} strokeWidth={2} />
                {anyHeroAvailable ? 'Buscar rival' : 'Héroes ocupados'}
              </>
            )}
          </motion.button>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 text-[22px]"
              style={{
                background: `color-mix(in srgb, ${classColor} 14%, var(--surface-2))`,
                borderColor: `color-mix(in srgb, ${classColor} 35%, var(--border))`,
              }}
            >
              {enemyClass ? CLASS_ICONS[enemyClass] : <Flame size={22} strokeWidth={1.8} />}
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <span className="text-[16px] font-bold text-text leading-tight truncate">{preview.enemyName}</span>
              <div className="flex items-center gap-1.5">
                {enemyClass && (
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded"
                    style={{
                      color: classColor,
                      background: `color-mix(in srgb, ${classColor} 12%, var(--surface))`,
                      border: `1px solid color-mix(in srgb, ${classColor} 30%, var(--border))`,
                    }}
                  >
                    {CLASS_LABELS[enemyClass]}
                  </span>
                )}
                <span className="text-[12px] font-semibold" style={{ color: tier.color }}>{tier.label}</span>
              </div>
            </div>
            <button
              className="flex-shrink-0 text-[12px] font-semibold text-text-3 px-3 py-1.5 rounded-lg border border-border bg-surface-2 font-[inherit] cursor-pointer"
              onClick={() => { setPreview(null); setHeroId(null) }}
            >
              Cambiar
            </button>
          </div>
        )}
      </div>

      {/* Héroe — solo si hay rival */}
      {preview && (
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 shadow-[var(--shadow-sm)]">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">
            {heroId ? 'Tu héroe' : 'Elige tu héroe'}
          </span>

          <HeroCombatPicker activeId={heroId} onSelect={setHeroId} />

          {/* Detalles del héroe seleccionado */}
          {heroId && hero && (() => {
            const pct        = Math.min(100, Math.round((hpNow / effectiveMaxHp) * 100))
            const hpColor    = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
            const recovering = hero.status === 'idle'
            const full       = hpNow >= effectiveMaxHp
            const equipped   = (items ?? []).filter(i => i.equipped_slot != null && (i.item_catalog?.max_durability ?? 0) > 0)
            const durPct     = equipped.length
              ? Math.round(equipped.reduce((s, i) => s + (i.current_durability / i.item_catalog.max_durability), 0) / equipped.length * 100)
              : null
            const durColor   = durPct == null ? '#6b7280' : durPct > 60 ? '#16a34a' : durPct > 30 ? '#d97706' : '#dc2626'
            return (
              <>
                <div className="-mt-2">
                  <RatingBanner hero={hero} />
                </div>

                <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
                  <div className="flex justify-between items-center text-[13px] font-semibold text-text-2">
                    <span className="flex items-center gap-[5px]"><Heart size={13} strokeWidth={2} color={hpColor} /> HP</span>
                    <span className="font-medium" style={{ color: hpColor }}>{hpNow} / {effectiveMaxHp}</span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width,background] duration-[400ms]${recovering ? ' animate-hp-regen-pulse' : ''}`}
                      style={{ width: `${pct}%`, background: hpColor }}
                    />
                  </div>
                  {durPct != null && (
                    <>
                      <div className="flex justify-between items-center text-[13px] font-semibold text-text-2 mt-1">
                        <span className="flex items-center gap-[5px]"><Shield size={13} strokeWidth={2} color={durColor} /> Equipo</span>
                        <span className="font-medium" style={{ color: durColor }}>{durPct}%</span>
                      </div>
                      <div className="h-2 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width,background] duration-[400ms]"
                          style={{ width: `${durPct}%`, background: durColor }}
                        />
                      </div>
                    </>
                  )}
                  {hpPotions.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {hpPotions.map(p => {
                        const disabled = full || isBusy || itemUseMutation.isPending
                        return (
                          <motion.button
                            key={p.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold transition-[opacity] duration-150 disabled:opacity-40"
                            style={{ color: 'var(--text-2)', borderColor: 'var(--border)', background: 'var(--surface)' }}
                            onClick={() => !disabled && itemUseMutation.mutate(p.id)}
                            disabled={disabled}
                            whileTap={disabled ? {} : { scale: 0.95 }}
                          >
                            <Heart size={11} strokeWidth={2.5} style={{ color: '#16a34a' }} />
                            {p.name}
                            <span className="opacity-60">×{p.quantity}</span>
                          </motion.button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <PotionPanel heroId={heroId} userId={userId} activeEffects={hero.active_effects ?? {}} title="Pociones de combate" />

                <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Tácticas</span>
                  <TacticsStrip heroId={heroId} onNavigate={() => navigateToHeroTab('tacticas')} />
                </div>

                <motion.button
                  className="btn btn--primary btn--lg btn--full"
                  onClick={startCombat}
                  disabled={combatMutation.isPending || matchmaking || isBusy || !hasEnoughHp}
                  whileTap={combatMutation.isPending || matchmaking || isBusy || !hasEnoughHp ? {} : { scale: 0.96 }}
                  whileHover={combatMutation.isPending || matchmaking || isBusy || !hasEnoughHp ? {} : { scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Swords size={16} strokeWidth={2} />
                  {combatMutation.isPending || matchmaking
                    ? 'Combatiendo...'
                    : isBusy
                      ? 'Héroe ocupado'
                      : !hasEnoughHp
                        ? 'HP insuficiente (20% mín.)'
                        : '¡Combatir!'}
                </motion.button>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
