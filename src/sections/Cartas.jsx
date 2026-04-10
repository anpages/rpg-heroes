import { useMemo, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useHeroCards } from '../hooks/useHeroCards'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { CARD_SLOT_COUNT } from '../lib/gameConstants'
import { cardBonusAtRank, cardPenaltyAtRank } from '../lib/gameFormulas'
import { useState } from 'react'
import { Sword, Shield, Wind, Brain, Layers, Wrench, Shuffle, FlameKindling, X, Info, Dumbbell, Heart } from 'lucide-react'
import { CardDetailModal } from '../components/CardDetailModal'

/* ─── Constantes ─────────────────────────────────────────────────────────────── */

const CATEGORY_META = {
  offense:   { label: 'Ofensa',      color: '#f97316', bg: 'linear-gradient(135deg, #431407 0%, #7c2d12 100%)', Icon: Sword    },
  defense:   { label: 'Resistencia', color: '#94a3b8', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', Icon: Shield   },
  mobility:  { label: 'Movilidad',   color: '#60a5fa', bg: 'linear-gradient(135deg, #0c1445 0%, #1e3a8a 100%)', Icon: Wind     },
  equipment: { label: 'Equipo',      color: '#fbbf24', bg: 'linear-gradient(135deg, #1c1003 0%, #422006 100%)', Icon: Wrench   },
  hybrid:    { label: 'Híbrida',     color: '#c084fc', bg: 'linear-gradient(135deg, #1a0533 0%, #3b0764 100%)', Icon: Shuffle  },
}

const FALLBACK_META = CATEGORY_META.offense

const STAT_LABELS = {
  attack: 'Ataque', defense: 'Defensa', max_hp: 'HP', strength: 'Fuerza',
  agility: 'Agilidad', intelligence: 'Inteligencia',
  weapon_attack_amp: 'Amp. arma', armor_defense_amp: 'Amp. armadura',
  durability_loss: 'Durabilidad', item_drop_rate: 'Drop rate',
}

const STAT_ICONS = {
  attack: Sword, defense: Shield, max_hp: Heart, strength: Dumbbell,
  agility: Wind, intelligence: Brain,
  weapon_attack_amp: Sword, armor_defense_amp: Shield,
  durability_loss: Wrench, item_drop_rate: Layers,
}

const STAT_COLORS = {
  attack: '#d97706', defense: '#475569', max_hp: '#dc2626', strength: '#dc2626',
  agility: '#2563eb', intelligence: '#7c3aed',
  weapon_attack_amp: '#d97706', armor_defense_amp: '#475569',
  durability_loss: '#d97706', item_drop_rate: '#16a34a',
}

const RANK_LABELS = ['', 'I', 'II', 'III', 'IV', 'V']

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function getMeta(sc) {
  return CATEGORY_META[sc.card_category] ?? FALLBACK_META
}

function getBonuses(sc) {
  return Array.isArray(sc.bonuses) ? sc.bonuses : []
}

function getPenalties(sc) {
  return Array.isArray(sc.penalties) ? sc.penalties : []
}

function formatVal(stat, val) {
  if (stat === 'weapon_attack_amp' || stat === 'armor_defense_amp' || stat === 'item_drop_rate')
    return `${Math.round(val * 100)}%`
  if (stat === 'durability_loss')
    return Math.round(Math.abs(val))
  return Math.round(Math.abs(val))
}

function StatBadge({ stat, value, isBonus }) {
  const StatIcon = STAT_ICONS[stat]
  const color    = STAT_COLORS[stat] ?? '#6b7280'
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color }}>
      {StatIcon && <StatIcon size={10} strokeWidth={2} />}
      {isBonus ? '+' : '−'}{formatVal(stat, value)} {STAT_LABELS[stat] ?? stat}
    </span>
  )
}

/* ─── Sub-componentes ────────────────────────────────────────────────────────── */


function CardSlot({ card, slotIndex, onUnequip, onViewDetail, isExploring }) {
  if (!card) {
    return (
      <>
        {/* Desktop: mini card */}
        <div className="hidden sm:flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/50 aspect-[3/4]">
          <span className="text-[12px] font-black text-text-3 opacity-30">{slotIndex + 1}</span>
          <span className="text-[9px] text-text-3 mt-0.5">Vacío</span>
        </div>
        {/* Mobile: row */}
        <div className="flex sm:hidden items-center gap-2.5 px-3 py-2.5 rounded-lg border border-dashed border-border bg-surface/50">
          <span className="text-[11px] font-black text-text-3 opacity-40 w-5 text-center flex-shrink-0">{slotIndex + 1}</span>
          <span className="text-[12px] text-text-3">Slot libre</span>
        </div>
      </>
    )
  }

  const sc        = card.skill_cards
  const meta      = getMeta(sc)
  const rank      = Math.min(card.rank ?? 1, 5)
  const bonuses   = getBonuses(sc)
  const penalties = getPenalties(sc)

  return (
    <>
      {/* ── Desktop: mini card + button below ── */}
      <div className="hidden sm:flex flex-col rounded-lg border border-border overflow-hidden">
        <div
          className="relative flex flex-col aspect-[3/4] cursor-pointer"
          style={{ background: meta.bg }}
          onClick={() => onViewDetail(card)}
        >
          {/* Category */}
          <div className="flex items-center gap-1 px-2 pt-2 pb-0.5">
            <meta.Icon size={9} strokeWidth={2} style={{ color: meta.color }} />
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
          </div>

          {/* Name */}
          <div className="flex-1 flex flex-col justify-center px-2">
            <span className="text-[12px] font-black text-white leading-tight tracking-tight">{sc.name}</span>
          </div>

          {/* Rank dots */}
          <div className="flex items-center gap-0.5 px-2 pb-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full border"
                style={{ background: i < rank ? meta.color : 'transparent', borderColor: i < rank ? meta.color : 'rgba(255,255,255,0.2)' }} />
            ))}
            <span className="text-[8px] font-black ml-0.5" style={{ color: meta.color }}>{RANK_LABELS[rank]}</span>
          </div>

          {/* Stats */}
          {(bonuses.length > 0 || penalties.length > 0) && (
            <div className="flex flex-col gap-px px-2 pb-2 border-t border-white/10 pt-1.5">
              {bonuses.slice(0, 2).map((b, i) => (
                <div key={`b${i}`} className="flex items-center justify-between text-[9px] font-semibold">
                  <span className="text-white/50">{STAT_LABELS[b.stat] ?? b.stat}</span>
                  <span style={{ color: STAT_COLORS[b.stat] ?? '#86efac' }}>+{formatVal(b.stat, cardBonusAtRank(b.value, rank))}</span>
                </div>
              ))}
              {penalties.slice(0, 1).map((p, i) => (
                <div key={`p${i}`} className="flex items-center justify-between text-[9px] font-semibold">
                  <span className="text-white/50">{STAT_LABELS[p.stat] ?? p.stat}</span>
                  <span className="text-[#fca5a5]">−{formatVal(p.stat, cardPenaltyAtRank(p.value, rank))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className="flex items-center justify-center gap-1 py-1.5 border-t border-border text-[10px] font-semibold text-text-3 hover:text-text-2 transition-colors bg-surface"
          onClick={(e) => { e.stopPropagation(); onUnequip(card.id) }}
          disabled={isExploring}
        >
          <X size={11} strokeWidth={2} /> Quitar
        </button>
      </div>

      {/* ── Mobile: row with gradient bg + X button below ── */}
      <div className="flex sm:hidden flex-col rounded-lg border border-border overflow-hidden">
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
          style={{ background: meta.bg }}
          onClick={() => onViewDetail(card)}
        >
          <meta.Icon size={14} strokeWidth={2} style={{ color: meta.color }} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-white truncate">{sc.name}</span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: i < rank ? meta.color : 'rgba(255,255,255,0.2)' }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {bonuses.slice(0, 2).map((b, i) => (
                <span key={`b${i}`} className="text-[10px] font-semibold" style={{ color: STAT_COLORS[b.stat] ?? '#86efac' }}>
                  +{formatVal(b.stat, cardBonusAtRank(b.value, rank))} {STAT_LABELS[b.stat]}
                </span>
              ))}
              {penalties.slice(0, 1).map((p, i) => (
                <span key={`p${i}`} className="text-[10px] font-semibold text-[#fca5a5]">
                  −{formatVal(p.stat, cardPenaltyAtRank(p.value, rank))} {STAT_LABELS[p.stat]}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          className="flex items-center justify-center gap-1 py-1.5 border-t border-border text-[10px] font-semibold text-text-3 hover:text-text-2 transition-colors bg-surface"
          onClick={(e) => { e.stopPropagation(); onUnequip(card.id) }}
          disabled={isExploring}
        >
          <X size={11} strokeWidth={2} /> Quitar
        </button>
      </div>
    </>
  )
}

function CollectionCard({ card, canEquip, fusePair, onEquip, onFuse, fuseLoading, onViewDetail, isExploring }) {
  const sc         = card.skill_cards
  const meta       = getMeta(sc)
  const rank       = Math.min(card.rank ?? 1, 5)
  const bonuses    = getBonuses(sc)
  const penalties  = getPenalties(sc)
  const topBonus   = bonuses[0]
  const topPenalty = penalties[0]

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Info */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/10"
          style={{ background: meta.bg }}>
          <meta.Icon size={14} strokeWidth={2} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-text truncate">{sc.name}</span>
            <span className="text-[10px] font-black flex-shrink-0" style={{ color: meta.color }}>
              {RANK_LABELS[rank] ?? rank}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {topBonus && (
              <StatBadge stat={topBonus.stat} value={cardBonusAtRank(topBonus.value, rank)} isBonus />
            )}
            {topPenalty && (
              <StatBadge stat={topPenalty.stat} value={cardPenaltyAtRank(topPenalty.value, rank)} isBonus={false} />
            )}
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="flex border-t border-border divide-x divide-border">
        <button
          className="flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-semibold text-text-3 hover:text-text-2 hover:bg-surface-2 transition-colors"
          onClick={() => onViewDetail(card)}
        >
          <Info size={11} strokeWidth={2} /> + Info
        </button>
        {fusePair && (
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-[#d97706] hover:bg-[color-mix(in_srgb,#d97706_6%,transparent)] transition-colors disabled:opacity-40"
            onClick={() => onFuse(card.id, fusePair.id)}
            disabled={fuseLoading || isExploring}
          >
            <FlameKindling size={12} strokeWidth={2} /> Fusionar
          </button>
        )}
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40
            ${canEquip
              ? 'text-[var(--blue-600)] hover:bg-[color-mix(in_srgb,var(--blue-500)_6%,transparent)]'
              : 'text-text-3 cursor-not-allowed'
            }`}
          onClick={() => canEquip && !isExploring && onEquip(card.id)}
          disabled={!canEquip || isExploring}
          title={canEquip ? undefined : 'Slots llenos — desequipa una carta primero'}
        >
          Equipar
        </button>
      </div>
    </div>
  )
}

/* ─── Componente principal ───────────────────────────────────────────────────── */

export default function Cartas() {
  const userId      = useAppStore(s => s.userId)
  const heroId      = useHeroId()
  const { hero }    = useHero(heroId)
  const isExploring = hero?.status === 'exploring'
  const { cards }   = useHeroCards(heroId)
  const queryClient  = useQueryClient()
  const equipPending = useRef(0)
  const [cardDetail, setCardDetail] = useState(null)

  // Equip / unequip: optimistic desde el cache actual, invalida solo al terminar todas
  const equipMutation = useMutation({
    mutationFn: ({ endpoint, body }) => apiPost(endpoint, body),
    onMutate: async ({ body }) => {
      equipPending.current++
      const key = queryKeys.heroCards(heroId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      const { cardId, slotIndex } = body
      queryClient.setQueryData(key, (previous ?? []).map(c =>
        c.id === cardId ? { ...c, slot_index: slotIndex ?? null } : c
      ))
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKeys.heroCards(heroId), context.previous)
      toast.error(err.message)
    },
    onSettled: () => {
      equipPending.current--
      if (equipPending.current === 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.heroCards(heroId) })
      }
    },
  })

  // Fusión: destructiva, bloquea solo el botón de fusionar
  const fuseMutation = useMutation({
    mutationFn: ({ endpoint, body }) => apiPost(endpoint, body),
    onMutate: async ({ body }) => {
      const key = queryKeys.heroCards(heroId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      const { cardId1, cardId2 } = body
      queryClient.setQueryData(key, (previous ?? []).filter(c => c.id !== cardId1 && c.id !== cardId2))
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKeys.heroCards(heroId), context.previous)
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroCards(heroId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.resources(userId) })
    },
  })

  const equippedCards = useMemo(() => {
    if (!cards) return []
    const arr = Array(CARD_SLOT_COUNT).fill(null)
    cards.forEach(c => {
      if (c.slot_index !== null && c.slot_index !== undefined && c.slot_index >= 0 && c.slot_index < CARD_SLOT_COUNT) {
        arr[c.slot_index] = c
      }
    })
    return arr
  }, [cards])

  const collectionCards = useMemo(() => (cards ?? []).filter(c => c.slot_index === null || c.slot_index === undefined), [cards])

  // Build fuse pairs: unequipped cards sharing card_id + rank
  const fuseMap = useMemo(() => {
    const map = {}
    collectionCards.forEach(c => {
      const key = `${c.card_id}-${c.rank}`
      if (!map[key]) map[key] = []
      map[key].push(c)
    })
    return map
  }, [collectionCards])

  const netTotals = useMemo(() => {
    const t = { attack: 0, defense: 0, max_hp: 0, strength: 0, agility: 0, intelligence: 0 }
    equippedCards.filter(Boolean).forEach(c => {
      const sc   = c.skill_cards
      const rank = Math.min(c.rank, 5)
      getBonuses(sc).forEach(b => { if (b.stat in t) t[b.stat] += cardBonusAtRank(b.value, rank) })
      getPenalties(sc).forEach(p => { if (p.stat in t) t[p.stat] -= cardPenaltyAtRank(p.value, rank) })
    })
    return t
  }, [equippedCards])

  if (!hero) {
    return (
      <div className="flex items-center justify-center h-40 text-text-3 text-[13px]">
        Selecciona un héroe
      </div>
    )
  }

  const equippedCount = equippedCards.filter(Boolean).length
  const activeStats   = Object.entries(netTotals).filter(([, v]) => v !== 0)

  function handleEquip(cardId) {
    const usedSlots = new Set(equippedCards.filter(Boolean).map(c => c.slot_index))
    const freeSlot  = [0, 1, 2, 3, 4].find(i => !usedSlots.has(i))
    if (freeSlot === undefined) {
      toast.error('Slots llenos. Desequipa una carta primero.')
      return
    }
    equipMutation.mutate({ endpoint: '/api/card-equip', body: { cardId, slotIndex: freeSlot } })
  }

  function handleUnequip(cardId) {
    equipMutation.mutate({ endpoint: '/api/card-equip', body: { cardId, slotIndex: null } })
  }

  function handleFuse(id1, id2) {
    fuseMutation.mutate({ endpoint: '/api/card-fuse', body: { cardId1: id1, cardId2: id2 } })
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Card slots */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Slots Equipados</p>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
          {/* Desktop: 5 cards in a row */}
          <div className="hidden sm:grid grid-cols-5 gap-2">
            {equippedCards.map((card, i) => (
              <CardSlot key={card?.id ?? `empty-${i}`} card={card} slotIndex={i} onUnequip={handleUnequip} onViewDetail={setCardDetail} isExploring={isExploring} />
            ))}
          </div>
          {/* Mobile: vertical list */}
          <div className="flex sm:hidden flex-col gap-2">
            {equippedCards.map((card, i) => (
              <CardSlot key={card?.id ?? `empty-${i}`} card={card} slotIndex={i} onUnequip={handleUnequip} onViewDetail={setCardDetail} isExploring={isExploring} />
            ))}
          </div>

          {/* Net stat summary */}
          {activeStats.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border">
              <span className="text-[10px] font-bold text-text-3 w-full uppercase tracking-wider">Efecto neto</span>
              {activeStats.map(([key, val]) => {
                const StatI = STAT_ICONS[key]
                const color = STAT_COLORS[key] ?? '#6b7280'
                return (
                  <span key={key}
                    className="inline-flex items-center gap-0.5 text-[11px] font-bold bg-surface-2 border border-border rounded-lg px-2 py-0.5"
                    style={{ color }}>
                    {StatI && <StatI size={10} strokeWidth={2} />}
                    {val > 0 ? '+' : ''}{val} {STAT_LABELS[key] ?? key}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Collection */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Colección</p>
          {collectionCards.length > 0 && (
            <span className="text-[11px] text-text-3">{collectionCards.length} sin equipar</span>
          )}
        </div>

        {collectionCards.length === 0 ? (
          <div className="flex items-center justify-center gap-2 h-20 text-[13px] text-text-3 border border-dashed border-border rounded-xl bg-surface">
            <Layers size={14} strokeWidth={1.8} />
            No hay cartas en colección
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {collectionCards.map(card => {
                const key      = `${card.card_id}-${card.rank}`
                const fusePair = fuseMap[key]?.find(c => c.id !== card.id) ?? null
                return (
                  <CollectionCard
                    key={card.id}
                    card={card}
                    canEquip={equippedCount < CARD_SLOT_COUNT}
                    fusePair={card.rank < 5 ? fusePair : null}
                    onEquip={handleEquip}
                    onFuse={handleFuse}
                    fuseLoading={fuseMutation.isPending}
                    onViewDetail={setCardDetail}
                    isExploring={isExploring}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {cardDetail && <CardDetailModal card={cardDetail} onClose={() => setCardDetail(null)} />}

    </div>
  )
}
