import { useState, useEffect, useReducer, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHero } from '../hooks/useHero'
import { useHeroId } from '../hooks/useHeroId'
import { useInventory } from '../hooks/useInventory'
import { useCraftedItems } from '../hooks/useCraftedItems'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { COMBAT_STRATEGIES } from '../lib/gameConstants'
import { Swords, Shield, Flame, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CombatReplay } from '../components/CombatReplay'
import { tierForRating } from '../lib/combatRating'
import { PotionPanel } from '../components/PotionPanel'

/* ─── Matchmaking overlay (buscar → 3 2 1) ───────────────────────────────────── */

const SEARCH_MESSAGES = [
  'Buscando rival',
  'Analizando oponentes',
  'Localizando objetivo',
  'Detectando desafiante',
]

function MatchmakingOverlay({ rivalFound, onReady }) {
  const [phase, setPhase]   = useState('search')   // 'search' | 'countdown'
  const [count, setCount]   = useState(3)
  const [dots, setDots]     = useState('')
  const [msgIdx, setMsgIdx] = useState(0)

  // Puntos animados
  useEffect(() => {
    if (phase !== 'search') return
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(id)
  }, [phase])

  // Ciclar mensajes
  useEffect(() => {
    if (phase !== 'search') return
    const id = setInterval(() => setMsgIdx(i => (i + 1) % SEARCH_MESSAGES.length), 1800)
    return () => clearInterval(id)
  }, [phase])

  // Cuando llega el rival, pasar a countdown
  useEffect(() => {
    if (rivalFound && phase === 'search') setPhase('countdown')
  }, [rivalFound, phase])

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return
    if (count <= 0) { onReady(); return }
    const id = setTimeout(() => setCount(c => c - 1), 700)
    return () => clearTimeout(id)
  }, [phase, count, onReady])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex flex-col items-center justify-center bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-[300px] h-[220px]"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <AnimatePresence mode="wait">
          {phase === 'search' && (
            <motion.div
              key="search"
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#06b6d4]/35 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-[#06b6d4]/22 animate-ping" style={{ animationDelay: '0.35s' }} />
                <Swords size={24} className="text-[#06b6d4] relative z-10" strokeWidth={1.8} />
              </div>
              <p className="text-[15px] font-bold text-text">
                {SEARCH_MESSAGES[msgIdx]}{dots}
              </p>
            </motion.div>
          )}

          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
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
                    initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
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
              <p className="text-text-3 text-[13px] font-semibold">¡Rival encontrado!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/* ─── Constantes de presentación ────────────────────────────────────────────── */

const CLASS_LABEL = {
  caudillo:  'Caudillo',
  sombra:    'Sombra',
  arcanista: 'Arcanista',
  domador:   'Domador',
  universal: 'Universal',
}
const CLASS_COLOR = {
  caudillo:  '#dc2626',
  sombra:    '#0369a1',
  arcanista: '#7c3aed',
  domador:   '#16a34a',
  universal: '#d97706',
}
const ARCHETYPE_LABEL = {
  berserker: 'Berserker',
  tank:      'Tanque',
  assassin:  'Asesino',
  mage:      'Mago',
}
const ARCHETYPE_ICON = {
  berserker: '⚔️',
  tank:      '🛡️',
  assassin:  '🗡️',
  mage:      '🔮',
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function QuickCombat() {
  const userId               = useAppStore(s => s.userId)

  const heroId               = useHeroId()
  const queryClient          = useQueryClient()
  const { hero }             = useHero(heroId)
  const { items }            = useInventory(heroId)
  const { catalog, inventory } = useCraftedItems(userId)

  // Fases: 'idle' | 'preview' | 'fighting'
  const [phase, setPhase]             = useState('idle')
  const [previewData, setPreviewData] = useState(null)   // { token, enemyName, enemyClass, enemyArchetype }
  const [strategy, setStrategy]       = useState(null)   // estrategia elegida para este combate

  const [matchmaking, setMatchmaking]     = useState(false)
  const [rivalFound, setRivalFound]       = useState(false)
  const [pendingResult, setPendingResult] = useState(null)
  const [result, setResult]               = useState(null)
  const [waitingForApi, setWaitingForApi] = useState(false)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 1000)
    return () => clearInterval(id)
  }, [])

  // Reset al cambiar de héroe
  useEffect(() => {
    setPhase('idle')
    setPreviewData(null)
    setStrategy(null)
  }, [heroId])

  const nowMs          = Date.now()
  const effectiveMaxHp = hero ? hero.max_hp + (items ?? [])
    .filter(i => i.equipped_slot && i.current_durability > 0)
    .reduce((s, i) => s + (i.item_catalog.hp_bonus ?? 0), 0) : 100
  const hpNow       = interpolateHp(hero, nowMs, effectiveMaxHp)
  const hasEnoughHp = hpNow >= Math.floor(effectiveMaxHp * 0.2)
  const isBusy      = hero?.status !== 'idle'
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

  // Fase 1: buscar rival (obtener preview)
  const previewMutation = useMutation({
    mutationFn: () => apiPost('/api/quick-combat-preview', { heroId }),
    onSuccess: (data) => {
      setPreviewData(data)
      setStrategy(hero?.combat_strategy ?? 'balanced')
      setPhase('preview')
    },
    onError: (err) => notify.error(err.message),
  })

  // Fase 2: luchar con la estrategia elegida
  const combatMutation = useMutation({
    mutationFn: ({ token, chosenStrategy }) =>
      apiPost('/api/quick-combat', { heroId, previewToken: token, strategy: chosenStrategy }),
    onSuccess: (data) => { setPendingResult(data); setRivalFound(true) },
    onError: (err) => {
      setMatchmaking(false)
      setRivalFound(false)
      setPhase('preview')
      notify.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.hero(heroId) })
    },
  })

  function fetchPreview() {
    previewMutation.mutate()
  }

  function startCombat() {
    setPendingResult(null)
    setRivalFound(false)
    setMatchmaking(true)
    setPhase('fighting')
    combatMutation.mutate({ token: previewData.token, chosenStrategy: strategy })
  }

  function revealResult(data) {
    setMatchmaking(false)
    setRivalFound(false)
    setResult(data)
    setPendingResult(null)
    setWaitingForApi(false)
    setPhase('idle')
  }

  function applyPostCombat() {
    // Simulador: sin cambios de estado en el servidor, nada que invalidar
  }

  useEffect(() => {
    if (waitingForApi && pendingResult) revealResult(pendingResult)
  }, [waitingForApi, pendingResult])

  const handleAnimationDone = useCallback(() => {
    if (pendingResult) revealResult(pendingResult)
    else setWaitingForApi(true)
  }, [pendingResult])

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Simulador</h2>
        <p className="section-subtitle">Prueba tácticas y estrategia sin coste ni recompensa.</p>
      </div>

      <AnimatePresence>
        {matchmaking && <MatchmakingOverlay rivalFound={rivalFound} onReady={handleAnimationDone} />}
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
          onClose={() => { applyPostCombat(result); setResult(null) }}
        />
      )}

      {/* Aviso — simulador sin consecuencias */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-2.5 shadow-[var(--shadow-sm)]">
        <Flame size={13} className="text-text-3 flex-shrink-0" strokeWidth={2} />
        <span className="text-[12px] text-text-3">Sin coste de HP · Sin desgaste de equipo · Sin recompensas</span>
      </div>

      {/* Héroe — cambia según fase */}
      <AnimatePresence mode="wait">

        {/* Fase preview: info del rival + selector de estrategia */}
        {phase === 'preview' && previewData && (
          <motion.div
            key="preview"
            className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 shadow-[var(--shadow-sm)]"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {/* Rival */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Rival de simulación</span>
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-lg border"
                style={{
                  borderColor: `color-mix(in srgb, ${CLASS_COLOR[previewData.enemyClass] ?? '#6b7280'} 30%, var(--border))`,
                  background:  `color-mix(in srgb, ${CLASS_COLOR[previewData.enemyClass] ?? '#6b7280'} 6%, var(--surface-2))`,
                }}
              >
                <span className="text-[24px] leading-none select-none">
                  {ARCHETYPE_ICON[previewData.enemyArchetype] ?? '⚔️'}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-text">{previewData.enemyName}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded border"
                      style={{
                        color: CLASS_COLOR[previewData.enemyClass] ?? '#6b7280',
                        borderColor: `color-mix(in srgb, ${CLASS_COLOR[previewData.enemyClass] ?? '#6b7280'} 30%, var(--border))`,
                        background:  `color-mix(in srgb, ${CLASS_COLOR[previewData.enemyClass] ?? '#6b7280'} 12%, var(--surface-2))`,
                      }}
                    >
                      {CLASS_LABEL[previewData.enemyClass] ?? previewData.enemyClass}
                    </span>
                    {previewData.enemyArchetype && (
                      <span className="text-[12px] text-text-3 font-semibold">
                        {ARCHETYPE_LABEL[previewData.enemyArchetype] ?? previewData.enemyArchetype}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Estrategia */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Elige tu estrategia</span>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(COMBAT_STRATEGIES).map(([key, s]) => {
                  const active = strategy === key
                  return (
                    <button
                      key={key}
                      className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border transition-[background,border-color] duration-150 font-[inherit] cursor-pointer"
                      style={{
                        borderColor: active ? '#2563eb' : 'var(--border)',
                        background:  active ? 'color-mix(in srgb, #2563eb 10%, var(--surface-2))' : 'var(--surface-2)',
                      }}
                      onClick={() => setStrategy(key)}
                    >
                      <span className="text-[20px] leading-none select-none">{s.icon}</span>
                      <span className="text-[12px] font-bold leading-tight" style={{ color: active ? '#2563eb' : 'var(--text-2)' }}>{s.label}</span>
                      <span className="text-[10px] text-text-3 text-center leading-tight">{s.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Acciones */}
            <motion.button
              className="btn btn--primary btn--lg btn--full"
              onClick={startCombat}
              disabled={!strategy || combatMutation.isPending}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Swords size={16} strokeWidth={2} />
              ¡Luchar!
            </motion.button>
          </motion.div>
        )}

        {/* Fase idle / fighting: estado del héroe + botón */}
        {(phase === 'idle' || phase === 'fighting') && (
          <motion.div
            key="idle"
            className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 shadow-[var(--shadow-sm)]"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Tu héroe</span>

            {heroId && hero && (() => {
              const pct      = Math.min(100, Math.round((hpNow / effectiveMaxHp) * 100))
              const hpColor  = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
              const full     = hpNow >= effectiveMaxHp
              const equipped = (items ?? []).filter(i => i.equipped_slot != null && (i.item_catalog?.max_durability ?? 0) > 0)
              const durPct   = equipped.length
                ? Math.round(equipped.reduce((s, i) => s + (i.current_durability / i.item_catalog.max_durability), 0) / equipped.length * 100)
                : null
              const durColor = durPct == null ? '#6b7280' : durPct > 60 ? '#16a34a' : durPct > 30 ? '#d97706' : '#dc2626'
              return (
                <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
                  <div className="flex justify-between items-center text-[13px] font-semibold text-text-2">
                    <span className="flex items-center gap-[5px]"><Heart size={13} strokeWidth={2} color={hpColor} /> HP</span>
                    <span className="font-medium" style={{ color: hpColor }}>{hpNow} / {effectiveMaxHp}</span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width,background] duration-[400ms] animate-hp-regen-pulse"
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
              )
            })()}

            {heroId && (
              <PotionPanel heroId={heroId} userId={userId} activeEffects={hero?.active_effects ?? {}} effectTypes={['atk_boost', 'def_boost', 'crit_boost', 'armor_pen', 'combat_shield', 'lifesteal_pct']} title="Pociones de combate" />
            )}

            {heroId && (
              <motion.button
                className="btn btn--primary btn--lg btn--full"
                onClick={fetchPreview}
                disabled={previewMutation.isPending || phase === 'fighting' || isBusy || !hasEnoughHp}
                whileTap={previewMutation.isPending || phase === 'fighting' || isBusy || !hasEnoughHp ? {} : { scale: 0.96 }}
                whileHover={previewMutation.isPending || phase === 'fighting' || isBusy || !hasEnoughHp ? {} : { scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Swords size={16} strokeWidth={2} />
                {previewMutation.isPending
                  ? 'Preparando simulación...'
                  : hero?.status === 'training'
                    ? 'Entrenando'
                    : isBusy
                    ? 'En expedición'
                    : !hasEnoughHp
                      ? 'HP insuficiente (20% mín.)'
                      : '¡Combatir!'}
              </motion.button>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
