import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useHeroCards } from '../hooks/useHeroCards'
import { queryKeys } from '../lib/queryKeys'
import { apiPost } from '../lib/api'
import { Sword, Shield, Wind, Brain, Plus, Layers, Wrench, Shuffle, FlameKindling } from 'lucide-react'

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
    return val > 0 ? `×${val}` : `${val}`
  return Math.abs(val)
}

/* ─── Sub-componentes ────────────────────────────────────────────────────────── */

function RankDots({ rank, max = 5, color }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className="w-2 h-2 rounded-full border"
          style={{ background: i < rank ? color : 'transparent', borderColor: i < rank ? color : 'rgba(255,255,255,0.2)' }} />
      ))}
    </div>
  )
}

function CardSlot({ card, slotIndex, onUnequip, loading }) {
  if (!card) {
    return (
      <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface/50 aspect-[3/4] min-h-[160px]">
        <Plus size={20} strokeWidth={1.5} className="text-text-3" />
        <span className="text-[11px] text-text-3 mt-1">Slot libre</span>
        <span className="absolute bottom-2 right-2 text-[10px] text-text-3 font-bold opacity-40">{slotIndex + 1}</span>
      </div>
    )
  }

  const sc       = card.skill_cards
  const meta     = getMeta(sc)
  const rank     = Math.min(card.rank ?? 1, 5)
  const bonuses  = getBonuses(sc)
  const penalties = getPenalties(sc)
  const rankLabel = RANK_LABELS[rank] ?? rank

  return (
    <div className="relative group flex flex-col rounded-2xl border border-white/10 overflow-hidden aspect-[3/4] min-h-[160px] shadow-lg" style={{ background: meta.bg }}>
      {/* Unequip overlay */}
      <button
        className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 hover:bg-black/50 transition-colors duration-200 opacity-0 group-hover:opacity-100"
        onClick={() => onUnequip(card.id)}
        disabled={loading}
        title="Desequipar"
      >
        <span className="text-[11px] font-bold text-white bg-black/60 rounded-lg px-3 py-1.5">Desequipar</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <meta.Icon size={11} strokeWidth={2} style={{ color: meta.color }} />
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <span className="text-[10px] font-black text-white/40">#{slotIndex + 1}</span>
      </div>

      {/* Card name */}
      <div className="flex-1 flex flex-col justify-center px-3">
        <span className="text-[14px] font-black text-white leading-tight tracking-tight">
          {sc.name}
        </span>
      </div>

      {/* Rank */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <RankDots rank={rank} color={meta.color} />
        <span className="text-[11px] font-black" style={{ color: meta.color }}>
          Rango {rankLabel}
        </span>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-0.5 px-3 pb-3 border-t border-white/10 pt-2">
        {bonuses.slice(0, 2).map((b, i) => (
          <div key={i} className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-white/60">{STAT_LABELS[b.stat] ?? b.stat}</span>
            <span className="text-[#86efac] font-bold">+{formatVal(b.stat, b.value * rank)}</span>
          </div>
        ))}
        {penalties.slice(0, 1).map((p, i) => (
          <div key={i} className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-white/60">{STAT_LABELS[p.stat] ?? p.stat}</span>
            <span className="text-[#fca5a5] font-bold">−{formatVal(p.stat, p.value * rank)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CollectionCard({ card, canEquip, fusePair, onEquip, onFuse, loading }) {
  const sc       = card.skill_cards
  const meta     = getMeta(sc)
  const rank     = Math.min(card.rank ?? 1, 5)
  const bonuses  = getBonuses(sc)
  const penalties = getPenalties(sc)
  const topBonus = bonuses[0]
  const topPenalty = penalties[0]

  return (
    <div className="relative flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-surface hover:border-[color:var(--blue-400)] transition-colors">
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
        <div className="flex items-center gap-2">
          {topBonus && (
            <span className="text-[10px] font-medium text-[#86efac]">
              +{formatVal(topBonus.stat, topBonus.value * rank)} {STAT_LABELS[topBonus.stat] ?? topBonus.stat}
            </span>
          )}
          {topPenalty && (
            <span className="text-[10px] font-medium text-[#fca5a5]">
              −{formatVal(topPenalty.stat, topPenalty.value * rank)} {STAT_LABELS[topPenalty.stat] ?? topPenalty.stat}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {fusePair && (
          <button
            className="flex items-center gap-1 text-[11px] font-bold text-[#d97706] bg-[color-mix(in_srgb,#d97706_10%,transparent)] border border-[color-mix(in_srgb,#d97706_25%,transparent)] rounded-lg px-2 py-1 hover:bg-[color-mix(in_srgb,#d97706_18%,transparent)] transition-colors disabled:opacity-40"
            onClick={() => onFuse(card.id, fusePair.id)}
            disabled={loading}
            title="Fusionar con carta idéntica → Rango superior"
          >
            <FlameKindling size={11} strokeWidth={2} />
            Fusionar
          </button>
        )}
        <button
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40"
          style={canEquip
            ? { color: 'var(--blue-600)', borderColor: 'var(--blue-400)', background: 'color-mix(in srgb, var(--blue-500) 8%, transparent)' }
            : { color: 'var(--text-3)', borderColor: 'var(--border)', background: 'var(--surface-2)', cursor: 'not-allowed' }
          }
          onClick={() => canEquip && onEquip(card.id)}
          disabled={!canEquip || loading}
          title={canEquip ? 'Equipar' : 'Slots llenos — desequipa una carta primero'}
        >
          Equipar
        </button>
      </div>
    </div>
  )
}

/* ─── Componente principal ───────────────────────────────────────────────────── */

const CARD_SLOT_COUNT = 5

export default function Cartas() {
  const heroId      = useHeroId()
  const { hero }    = useHero(heroId)
  const { cards }   = useHeroCards(heroId)
  const queryClient = useQueryClient()

  const cardMutation = useMutation({
    mutationFn: ({ endpoint, body }) => apiPost(endpoint, body),
    onMutate: async ({ optimisticUpdate }) => {
      if (!optimisticUpdate) return
      const key = queryKeys.heroCards(heroId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, optimisticUpdate)
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKeys.heroCards(heroId), context.previous)
      toast.error(err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.heroCards(heroId) })
    },
  })

  const equippedCards = useMemo(() => {
    if (!cards) return []
    const equipped = cards.filter(c => c.equipped).slice(0, CARD_SLOT_COUNT)
    while (equipped.length < CARD_SLOT_COUNT) equipped.push(null)
    return equipped
  }, [cards])

  const collectionCards = useMemo(() => (cards ?? []).filter(c => !c.equipped), [cards])

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
      getBonuses(sc).forEach(b => { if (b.stat in t) t[b.stat] += b.value * rank })
      getPenalties(sc).forEach(p => { if (p.stat in t) t[p.stat] -= p.value * rank })
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
  const loading       = cardMutation.isPending
  const activeStats   = Object.entries(netTotals).filter(([, v]) => v !== 0)

  function handleEquip(cardId) {
    if (equippedCount >= CARD_SLOT_COUNT) {
      toast.error('Slots llenos. Desequipa una carta primero.')
      return
    }
    cardMutation.mutate({
      endpoint: '/api/card-equip',
      body: { cardId, equip: true },
      optimisticUpdate: cards?.map(c => c.id === cardId ? { ...c, equipped: true } : c),
    })
  }

  function handleUnequip(cardId) {
    cardMutation.mutate({
      endpoint: '/api/card-equip',
      body: { cardId, equip: false },
      optimisticUpdate: cards?.map(c => c.id === cardId ? { ...c, equipped: false } : c),
    })
  }

  function handleFuse(id1, id2) {
    cardMutation.mutate({
      endpoint: '/api/card-fuse',
      body: { cardId1: id1, cardId2: id2 },
      optimisticUpdate: cards?.filter(c => c.id !== id1 && c.id !== id2),
    })
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Layers size={16} strokeWidth={1.8} className="text-[var(--blue-600)]" />
            <span className="text-[16px] font-bold text-text">Build de Cartas</span>
          </div>
          <span className="text-[12px] text-text-3">
            {hero.name} · {equippedCount}/{CARD_SLOT_COUNT} slots activos
          </span>
        </div>
        <div className="text-right">
          <span className="text-[12px] text-text-3">{(cards ?? []).length} cartas en colección</span>
        </div>
      </div>

      {/* Card slots */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Slots Equipados</p>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {equippedCards.map((card, i) => (
              <CardSlot key={card?.id ?? `empty-${i}`} card={card} slotIndex={i} onUnequip={handleUnequip} loading={loading} />
            ))}
          </div>

          {/* Net stat summary */}
          {activeStats.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border">
              <span className="text-[10px] font-bold text-text-3 w-full uppercase tracking-wider">Efecto neto</span>
              {activeStats.map(([key, val]) => (
                <span key={key}
                  className="text-[11px] font-bold bg-surface-2 border border-border rounded-lg px-2 py-0.5"
                  style={{ color: val > 0 ? '#86efac' : '#fca5a5' }}>
                  {val > 0 ? '+' : ''}{val} {STAT_LABELS[key] ?? key}
                </span>
              ))}
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
                    loading={loading}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
