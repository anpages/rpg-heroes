import { useMemo } from 'react'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useHeroCards } from '../hooks/useHeroCards'
import { Sword, Shield, Heart, Dumbbell, Wind, Brain, Plus, Layers } from 'lucide-react'

/* ─── Constantes ─────────────────────────────────────────────────────────────── */

const CATEGORY_META = {
  attack:       { label: 'Ataque',       color: '#d97706', bg: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)', Icon: Sword    },
  defense:      { label: 'Defensa',      color: '#94a3b8', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', Icon: Shield   },
  strength:     { label: 'Fuerza',       color: '#f87171', bg: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)', Icon: Dumbbell },
  agility:      { label: 'Agilidad',     color: '#60a5fa', bg: 'linear-gradient(135deg, #0c1445 0%, #1e3a8a 100%)', Icon: Wind     },
  intelligence: { label: 'Inteligencia', color: '#c084fc', bg: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)', Icon: Brain    },
}

const STAT_LABELS = {
  attack: 'Ataque', defense: 'Defensa', hp: 'HP', strength: 'Fuerza',
  agility: 'Agilidad', intelligence: 'Inteligencia',
}

const RANK_LABELS = ['', 'I', 'II', 'III', 'IV', 'V']

/* ─── Sub-componentes ────────────────────────────────────────────────────────── */

function RankDots({ rank, max = 5, color }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full border"
          style={{
            background:   i < rank ? color : 'transparent',
            borderColor:  i < rank ? color : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </div>
  )
}

function CardStatLine({ label, value, isBonus }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between text-[11px] font-semibold">
      <span style={{ color: isBonus ? '#86efac' : '#fca5a5' }}>
        {isBonus ? '+' : '−'}{Math.abs(value)} {label}
      </span>
    </div>
  )
}

function CardSlot({ card, slotIndex }) {
  if (!card) {
    return (
      <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface/50 aspect-[3/4] min-h-[160px] cursor-pointer hover:border-[color:var(--blue-400)] hover:bg-[var(--blue-50)] transition-all duration-200 group">
        <Plus size={20} strokeWidth={1.5} className="text-text-3 group-hover:text-[var(--blue-600)] transition-colors" />
        <span className="text-[11px] text-text-3 group-hover:text-[var(--blue-600)] mt-1 transition-colors">Slot libre</span>
        <span className="absolute bottom-2 right-2 text-[10px] text-text-3 font-bold opacity-40">{slotIndex + 1}</span>
      </div>
    )
  }

  const sc       = card.skill_cards
  const category = sc.category ?? 'attack'
  const meta     = CATEGORY_META[category] ?? CATEGORY_META.attack
  const rank     = Math.min(card.rank ?? 1, 5)

  // Positive stat bonuses
  const bonuses = [
    { key: 'attack',       val: sc.attack_bonus       },
    { key: 'defense',      val: sc.defense_bonus      },
    { key: 'hp',           val: sc.hp_bonus           },
    { key: 'strength',     val: sc.strength_bonus     },
    { key: 'agility',      val: sc.agility_bonus      },
    { key: 'intelligence', val: sc.intelligence_bonus },
  ].filter(s => s.val > 0)

  const rankLabel = RANK_LABELS[rank] ?? rank

  return (
    <div
      className="relative flex flex-col rounded-2xl border border-white/10 overflow-hidden aspect-[3/4] min-h-[160px] cursor-pointer shadow-lg hover:scale-[1.03] hover:shadow-xl transition-all duration-200"
      style={{ background: meta.bg }}
    >
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
        {bonuses.slice(0, 3).map(b => (
          <CardStatLine
            key={b.key}
            label={STAT_LABELS[b.key]}
            value={b.val * rank}
            isBonus={true}
          />
        ))}
        {/* v2: penalties will appear here */}
      </div>
    </div>
  )
}

function CollectionCard({ card, isEquipped }) {
  const sc       = card.skill_cards
  const category = sc.category ?? 'attack'
  const meta     = CATEGORY_META[category] ?? CATEGORY_META.attack
  const rank     = Math.min(card.rank ?? 1, 5)

  const topBonus = [
    { key: 'attack', val: sc.attack_bonus }, { key: 'defense', val: sc.defense_bonus },
    { key: 'hp', val: sc.hp_bonus }, { key: 'strength', val: sc.strength_bonus },
    { key: 'agility', val: sc.agility_bonus }, { key: 'intelligence', val: sc.intelligence_bonus },
  ].filter(s => s.val > 0)[0]

  return (
    <div className="relative flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-surface hover:border-[color:var(--blue-400)] transition-colors cursor-pointer">
      {isEquipped && (
        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#16a34a]" title="Equipada" />
      )}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/10"
        style={{ background: meta.bg }}
      >
        <meta.Icon size={14} strokeWidth={2} style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-text truncate">{sc.name}</span>
          <span className="text-[10px] font-black flex-shrink-0" style={{ color: meta.color }}>
            {RANK_LABELS[rank] ?? rank}
          </span>
        </div>
        {topBonus && (
          <span className="text-[10px] font-medium text-[#86efac]">
            +{topBonus.val * rank} {STAT_LABELS[topBonus.key]}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Componente principal ───────────────────────────────────────────────────── */

const CARD_SLOT_COUNT = 5

export default function Cartas() {
  const heroId = useHeroId()
  const { hero }  = useHero(heroId)
  const { cards } = useHeroCards(heroId)

  const equippedCards = useMemo(() => {
    if (!cards) return []
    const equipped = cards.filter(c => c.equipped).slice(0, CARD_SLOT_COUNT)
    // Pad to 5 slots
    while (equipped.length < CARD_SLOT_COUNT) equipped.push(null)
    return equipped
  }, [cards])

  const collectionCards = useMemo(() => (cards ?? []).filter(c => !c.equipped), [cards])
  const equippedSet     = useMemo(() => new Set((cards ?? []).filter(c => c.equipped).map(c => c.id)), [cards])

  if (!hero) {
    return (
      <div className="flex items-center justify-center h-40 text-text-3 text-[13px]">
        Selecciona un héroe
      </div>
    )
  }

  const equippedCount = equippedCards.filter(Boolean).length

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
              <CardSlot key={i} card={card} slotIndex={i} />
            ))}
          </div>

          {/* Stat summary inline */}
          {equippedCount > 0 && (() => {
            const totals = { attack: 0, defense: 0, hp: 0, strength: 0, agility: 0, intelligence: 0 }
            equippedCards.filter(Boolean).forEach(c => {
              const sc = c.skill_cards
              const r  = Math.min(c.rank, 20)
              totals.attack       += (sc.attack_bonus       ?? 0) * r
              totals.defense      += (sc.defense_bonus      ?? 0) * r
              totals.hp           += (sc.hp_bonus           ?? 0) * r
              totals.strength     += (sc.strength_bonus     ?? 0) * r
              totals.agility      += (sc.agility_bonus      ?? 0) * r
              totals.intelligence += (sc.intelligence_bonus ?? 0) * r
            })
            const active = Object.entries(totals).filter(([, v]) => v > 0)
            if (!active.length) return null
            return (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border">
                <span className="text-[10px] font-bold text-text-3 w-full uppercase tracking-wider">Bonus activos</span>
                {active.map(([key, val]) => (
                  <span key={key} className="text-[11px] font-bold text-[#86efac] bg-surface-2 border border-border rounded-lg px-2 py-0.5">
                    +{val} {STAT_LABELS[key]}
                  </span>
                ))}
              </div>
            )
          })()}
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
              {collectionCards.map(card => (
                <CollectionCard key={card.id} card={card} isEquipped={equippedSet.has(card.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* v2 note */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--blue-50)] border border-[var(--blue-200)] text-[11px] text-[var(--blue-700)]">
        <span className="font-bold flex-shrink-0">Sistema v2:</span>
        <span>Las cartas tendrán pros Y contras, 5 slots libres, fusión por ranking, e interacción con equipo y encantamientos del laboratorio.</span>
      </div>

    </div>
  )
}
