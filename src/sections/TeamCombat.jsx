import { useState, useReducer, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Swords, Users, Heart, Shield, Check, Coins, Star, AlertTriangle, FlaskConical } from 'lucide-react'
import { notify } from '../lib/notifications'
import { useAppStore } from '../store/appStore'
import { useHeroes } from '../hooks/useHeroes'
import { usePotions } from '../hooks/usePotions'
import { queryKeys } from '../lib/queryKeys'
import { teamCombatsKey } from '../hooks/useTeamCombats'
import { apiPost } from '../lib/api'
import { interpolateHp } from '../lib/hpInterpolation'
import { computeSynergy, roleForClass } from '../lib/teamSynergy'
import { trainingRewards } from '../lib/gameFormulas'
import { TeamCombatReplay } from '../components/TeamCombatReplay'

const CLASS_COLOR = {
  caudillo:  '#dc2626',
  arcanista: '#7c3aed',
  sombra:    '#0369a1',
  domador:   '#16a34a',
}

const CLASS_LABEL = {
  caudillo:  'Caudillo',
  arcanista: 'Arcanista',
  sombra:    'Sombra',
  domador:   'Domador',
}

function HeroPickCard({ hero, selected, disabled, onToggle, hpPotions, onUsePotion, potionPending }) {
  const nowMs = Date.now()
  const hpNow = interpolateHp(hero, nowMs)
  const pct   = Math.round((hpNow / hero.max_hp) * 100)
  const busy  = hero.status !== 'idle'
  const lowHp = hpNow < Math.floor(hero.max_hp * 0.2)
  const canUse = !busy && !lowHp
  const role = roleForClass(hero.class)
  const color = CLASS_COLOR[hero.class] ?? '#6b7280'

  return (
    <motion.div
      className="relative flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-[border-color,background] duration-150"
      style={{
        borderColor: selected ? color : 'var(--border)',
        background: selected
          ? `color-mix(in srgb, ${color} 10%, var(--surface))`
          : 'var(--surface)',
        opacity: canUse ? 1 : 0.85,
      }}
    >
      <button
        type="button"
        onClick={() => !disabled && canUse && onToggle(hero.id)}
        disabled={disabled || !canUse}
        className="absolute inset-0 rounded-xl disabled:cursor-not-allowed z-[1] bg-transparent border-0 p-0"
        aria-label={`Seleccionar ${hero.name}`}
      />

      {selected && (
        <span
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center z-[2]"
          style={{ background: color }}
        >
          <Check size={12} color="#fff" strokeWidth={3} />
        </span>
      )}
      <div className="flex items-center gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[13px] font-extrabold text-text truncate">{hero.name}</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em]">
            <span style={{ color }}>{CLASS_LABEL[hero.class] ?? hero.class}</span>
            <span className="text-text-3">·</span>
            <span className="text-text-3">Nv.{hero.level}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 12%, var(--surface-2))`,
            border: `1px solid color-mix(in srgb, ${color} 25%, var(--border))`,
          }}
          title={role.label}
        >
          <Shield size={9} strokeWidth={2.5} />
          {role.label}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] font-semibold">
          <span className="flex items-center gap-1 text-text-3">
            <Heart size={9} strokeWidth={2.5} /> HP
          </span>
          <span className="text-text-2 tabular-nums">{hpNow}/{hero.max_hp}</span>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, pct)}%`,
              background: pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626',
            }}
          />
        </div>
      </div>

      {busy && (
        <span className="text-[10px] font-bold text-[#d97706]">En expedición</span>
      )}

      {!busy && lowHp && (
        <div className="flex flex-col gap-1 relative z-[2]">
          <span className="text-[10px] font-bold text-[#dc2626]">HP &lt; 20%</span>
          {hpPotions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {hpPotions.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUsePotion(hero.id, p.id) }}
                  disabled={potionPending}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-surface hover:bg-surface-2 disabled:opacity-40 transition-[background,opacity] duration-150"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                >
                  <FlaskConical size={9} strokeWidth={2.5} className="text-[#16a34a]" />
                  {p.name}
                  <span className="opacity-60">×{p.quantity}</span>
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-text-3">Sin pociones</span>
          )}
        </div>
      )}
    </motion.div>
  )
}

function SynergyBadge({ synergy }) {
  if (!synergy) return null
  const isBonus  = synergy.attackPct > 0
  const isMalus  = synergy.attackPct < 0
  const color    = isBonus ? '#16a34a' : isMalus ? '#dc2626' : '#6b7280'
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
      style={{
        background: `color-mix(in srgb, ${color} 8%, var(--surface-2))`,
        borderColor: `color-mix(in srgb, ${color} 30%, var(--border))`,
      }}
    >
      <Users size={14} strokeWidth={2} style={{ color }} />
      <span className="flex flex-col flex-1 min-w-0">
        <span className="text-[12px] font-extrabold" style={{ color }}>{synergy.label}</span>
        <span className="text-[10px] text-text-3">
          {synergy.distinctClasses} {synergy.distinctClasses === 1 ? 'clase' : 'clases'} distinta{synergy.distinctClasses === 1 ? '' : 's'}
        </span>
      </span>
      {synergy.attackPct !== 0 && (
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {isBonus ? '+' : ''}{Math.round(synergy.attackPct * 100)}% atk/def
        </span>
      )}
    </div>
  )
}

export default function TeamCombat() {
  const userId               = useAppStore(s => s.userId)
  const triggerResourceFlash = useAppStore(s => s.triggerResourceFlash)
  const queryClient          = useQueryClient()
  const { heroes, loading } = useHeroes(userId)
  const { potions } = usePotions(userId)
  const [selected, setSelected] = useState([])
  const [result, setResult] = useState(null)
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  const hpPotions = (potions ?? []).filter(p => p.effect_type === 'hp_restore' && p.quantity > 0)

  useEffect(() => {
    const id = setInterval(forceUpdate, 10000)
    return () => clearInterval(id)
  }, [])

  // Auto-select: cuando hay exactamente 3 héroes, pre-seleccionar los 3.
  useEffect(() => {
    if (heroes.length === 3 && selected.length === 0) {
      setSelected(heroes.map(h => h.id))
    }
  }, [heroes, selected.length])

  const potionMutation = useMutation({
    mutationFn: async ({ heroId, potionId }) => {
      await apiPost('/api/potion-use', { heroId, potionId })
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.potions(userId) }),
        queryClient.refetchQueries({ queryKey: queryKeys.heroes(userId) }),
      ])
    },
    onError: err => notify.error(err.message),
  })

  function toggle(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }

  const selectedHeroes = selected.map(id => heroes.find(h => h.id === id)).filter(Boolean)
  const synergy = selectedHeroes.length === 3
    ? computeSynergy(selectedHeroes.map(h => h.class))
    : null

  const avgLevel = selectedHeroes.length === 3
    ? Math.max(1, Math.round(selectedHeroes.reduce((a, h) => a + h.level, 0) / 3))
    : 1
  const baseRewards = trainingRewards(avgLevel)
  const estGold = Math.round(baseRewards.gold * 3.0)
  const estXp   = Math.round(baseRewards.experience * 1.5)

  const combatMutation = useMutation({
    mutationFn: () => apiPost('/api/team-combat', { heroIds: selected }),
    onSuccess: (data) => {
      setResult(data)
    },
    onError: (err) => {
      notify.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
    },
  })

  function applyPostCombat(data) {
    if (!data) return
    if (data.won) {
      triggerResourceFlash()
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.heroes(userId) })
    queryClient.invalidateQueries({ queryKey: teamCombatsKey(userId) })
    queryClient.invalidateQueries({ queryKey: ['team-ranking'] })
  }

  if (loading) return <div className="text-text-3 text-[14px] p-10 text-center">Cargando héroes...</div>

  if ((heroes?.length ?? 0) < 3) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <div className="section-header">
          <h2 className="section-title">Escuadrón</h2>
          <p className="section-subtitle">Combates 3v3 con tus héroes. Sinergia de clases, roles tipo MOBA y retos épicos.</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center gap-3 text-center">
          <AlertTriangle size={32} className="text-[#d97706]" strokeWidth={1.8} />
          <p className="text-[15px] font-bold text-text">Necesitas al menos 3 héroes</p>
          <p className="text-[13px] text-text-3 max-w-sm">
            Desbloquea nuevos slots de héroe en la Base para formar un escuadrón. Los combates 3v3 se activan automáticamente cuando tienes 3 o más héroes.
          </p>
        </div>
      </div>
    )
  }

  // Validación de lanzamiento: todos seleccionados, ninguno ocupado ni bajo de HP.
  const nowMs = Date.now()
  const blockers = selectedHeroes.map(h => {
    if (h.status !== 'idle') return { name: h.name, reason: 'en expedición' }
    const hpNow = interpolateHp(h, nowMs)
    if (hpNow < Math.floor(h.max_hp * 0.2)) return { name: h.name, reason: 'HP < 20%' }
    return null
  }).filter(Boolean)

  const canLaunch = selected.length === 3 && !combatMutation.isPending && blockers.length === 0
  const autoLocked = heroes.length === 3

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="section-header">
        <h2 className="section-title">Escuadrón</h2>
        <p className="section-subtitle">
          {autoLocked
            ? 'Tu trío completo entra al combate 3v3. La diversidad de clases activa sinergias poderosas.'
            : 'Elige 3 héroes y lánzate a un combate 3v3. La diversidad de clases activa sinergias poderosas.'}
        </p>
      </div>

      {/* Replay */}
      {result && (
        <TeamCombatReplay
          teamA={result.teamA}
          teamB={result.teamB}
          log={result.log}
          won={result.won}
          rewards={result.rewards}
          ratings={result.ratings}
          synergy={result.synergy?.player}
          onClose={() => { applyPostCombat(result); setResult(null); if (!autoLocked) setSelected([]) }}
        />
      )}

      {/* Selector */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">
            {autoLocked ? 'Tu escuadrón' : 'Alineación'}
          </span>
          <span className="text-[12px] font-bold text-text-2 tabular-nums">{selected.length}/3</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {heroes.map(h => (
            <HeroPickCard
              key={h.id}
              hero={h}
              selected={selected.includes(h.id)}
              disabled={combatMutation.isPending || (!autoLocked && selected.length >= 3 && !selected.includes(h.id))}
              onToggle={toggle}
              hpPotions={hpPotions}
              onUsePotion={(heroId, potionId) => potionMutation.mutate({ heroId, potionId })}
              potionPending={potionMutation.isPending}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      {selected.length === 3 && (
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 shadow-[var(--shadow-sm)]">
          <SynergyBadge synergy={synergy} />

          <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3 mr-auto">Recompensa</span>
            <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
              <Coins size={13} color="#d97706" strokeWidth={2} />+{estGold} oro
            </span>
            <span className="flex items-center gap-[5px] text-[13px] font-semibold text-[#15803d]">
              <Star size={13} color="#0369a1" strokeWidth={2} />+{estXp} XP c/u
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] font-semibold text-[#16a34a] bg-[color-mix(in_srgb,#16a34a_10%,var(--surface-2))] border border-[color-mix(in_srgb,#16a34a_25%,var(--border))] px-2 py-1 rounded-md">
              Sin desgaste de equipo
            </span>
            <span className="text-[11px] font-semibold text-[#d97706] bg-[color-mix(in_srgb,#d97706_10%,var(--surface-2))] border border-[color-mix(in_srgb,#d97706_25%,var(--border))] px-2 py-1 rounded-md">
              HP plano a los 3 héroes
            </span>
            <span className="text-[11px] font-semibold text-[#7c3aed] bg-[color-mix(in_srgb,#7c3aed_10%,var(--surface-2))] border border-[color-mix(in_srgb,#7c3aed_25%,var(--border))] px-2 py-1 rounded-md">
              +25 rating al ganar
            </span>
          </div>

          {blockers.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-[color-mix(in_srgb,#dc2626_8%,var(--surface-2))] border border-[color-mix(in_srgb,#dc2626_25%,var(--border))] rounded-lg">
              <AlertTriangle size={14} className="text-[#dc2626] mt-0.5 flex-shrink-0" strokeWidth={2} />
              <span className="text-[11px] text-[#dc2626] font-semibold">
                {blockers.map(b => `${b.name} (${b.reason})`).join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      <motion.button
        className="btn btn--primary btn--lg btn--full"
        onClick={() => combatMutation.mutate()}
        disabled={!canLaunch}
        whileTap={canLaunch ? { scale: 0.96 } : {}}
        whileHover={canLaunch ? { scale: 1.01 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <Swords size={16} strokeWidth={2} />
        {combatMutation.isPending
          ? 'Librando combate...'
          : selected.length < 3
            ? `Elige ${3 - selected.length} ${3 - selected.length === 1 ? 'héroe' : 'héroes'} más`
            : blockers.length > 0
              ? 'Escuadrón no disponible'
              : 'Iniciar combate 3v3'}
      </motion.button>
    </div>
  )
}
