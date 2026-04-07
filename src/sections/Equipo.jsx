import { useMemo } from 'react'
import { useHeroId } from '../hooks/useHeroId'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useHeroCards } from '../hooks/useHeroCards'
import { interpolateHp } from '../lib/hpInterpolation'
import {
  Crown, Shirt, Hand, Move, Sword, Shield, Gem,
  Heart, Dumbbell, Wind, Brain, Backpack, Package,
} from 'lucide-react'

/* ─── Constantes ─────────────────────────────────────────────────────────────── */

const SLOT_META = {
  helmet:      { label: 'Casco',           Icon: Crown  },
  chest:       { label: 'Torso',           Icon: Shirt  },
  arms:        { label: 'Brazos',          Icon: Hand   },
  legs:        { label: 'Piernas',         Icon: Move   },
  main_hand:   { label: 'Arma Principal',  Icon: Sword  },
  off_hand:    { label: 'Mano Secundaria', Icon: Shield },
  accessory:   { label: 'Complemento',     Icon: Gem    },
  accessory_2: { label: 'Complemento 2',   Icon: Gem    },
}

const ALL_SLOTS = ['helmet', 'chest', 'arms', 'legs', 'main_hand', 'off_hand', 'accessory', 'accessory_2']

const RARITY_COLORS = {
  common:    '#6b7280',
  uncommon:  '#16a34a',
  rare:      '#2563eb',
  epic:      '#7c3aed',
  legendary: '#d97706',
}

const STAT_CONFIG = [
  { key: 'attack',       label: 'Ataque',       bonusKey: 'attack_bonus',       color: '#d97706', Icon: Sword    },
  { key: 'defense',      label: 'Defensa',       bonusKey: 'defense_bonus',      color: '#6b7280', Icon: Shield   },
  { key: 'strength',     label: 'Fuerza',        bonusKey: 'strength_bonus',     color: '#dc2626', Icon: Dumbbell },
  { key: 'agility',      label: 'Agilidad',      bonusKey: 'agility_bonus',      color: '#2563eb', Icon: Wind     },
  { key: 'intelligence', label: 'Inteligencia',  bonusKey: 'intelligence_bonus', color: '#7c3aed', Icon: Brain    },
  { key: 'max_hp',       label: 'HP Máximo',     bonusKey: 'hp_bonus',           color: '#dc2626', Icon: Heart    },
]

/* ─── Sub-componentes ────────────────────────────────────────────────────────── */

function DurabilityBar({ current, max }) {
  const pct   = max > 0 ? Math.round((current / max) * 100) : 0
  const color = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
  return (
    <div className="w-full h-[3px] bg-border rounded-full overflow-hidden mt-1.5">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function mainStatForSlot(slotKey, cat) {
  if (slotKey === 'main_hand' || slotKey === 'off_hand') {
    if (cat.attack_bonus > 0)  return { label: 'Atq', value: cat.attack_bonus,  color: '#d97706' }
    if (cat.defense_bonus > 0) return { label: 'Def', value: cat.defense_bonus, color: '#6b7280' }
  }
  if (cat.defense_bonus > 0) return { label: 'Def', value: cat.defense_bonus, color: '#6b7280' }
  if (cat.attack_bonus  > 0) return { label: 'Atq', value: cat.attack_bonus,  color: '#d97706' }
  if (cat.hp_bonus      > 0) return { label: 'HP',  value: cat.hp_bonus,      color: '#dc2626' }
  return null
}

function EquipmentSlot({ slotKey, item }) {
  const { label, Icon } = SLOT_META[slotKey]

  if (!item) {
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-border bg-surface/40 min-h-[64px] select-none">
        <div className="w-8 h-8 flex items-center justify-center text-text-3 flex-shrink-0 opacity-50">
          <Icon size={15} strokeWidth={1.5} />
        </div>
        <span className="text-[12px] text-text-3 font-medium">{label}</span>
      </div>
    )
  }

  const cat      = item.item_catalog
  const mainStat = mainStatForSlot(slotKey, cat)
  const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'

  return (
    <div className="flex flex-col p-3 rounded-xl border border-border bg-surface hover:border-[color:var(--blue-400)] hover:shadow-[0_0_0_1px_var(--blue-200)] transition-all duration-150 cursor-pointer group min-h-[64px] gap-0.5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ color: rarColor }}>
          <Icon size={13} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[12px] font-semibold truncate" style={{ color: rarColor }}>{cat.name}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {mainStat && (
                <span className="text-[11px] font-bold" style={{ color: mainStat.color }}>+{mainStat.value}</span>
              )}
              <span className="text-[10px] font-bold text-text-3 bg-surface-2 border border-border rounded px-1">T{cat.tier}</span>
            </div>
          </div>
          <span className="text-[10px] text-text-3 capitalize">{label}</span>
        </div>
      </div>
      <DurabilityBar current={item.current_durability} max={cat.max_durability} />
    </div>
  )
}

function StatRow({ statKey, label, color, Icon: StatIcon, base, equipBonus, cardBonus }) {
  const total  = base + equipBonus + cardBonus
  const maxVal = Math.max(30, total * 1.6)
  const basePct  = Math.min(100, (base       / maxVal) * 100)
  const eqPct    = Math.min(100 - basePct,             ((equipBonus) / maxVal) * 100)
  const cardPct  = Math.min(100 - basePct - eqPct,     ((cardBonus)  / maxVal) * 100)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StatIcon size={11} strokeWidth={2} style={{ color }} />
          <span className="text-[11px] font-semibold text-text-2">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          {(equipBonus > 0 || cardBonus > 0) && (
            <span className="text-[10px] text-text-3">{base} →</span>
          )}
          <span className="text-[13px] font-bold text-text">{total}</span>
        </div>
      </div>
      <div className="h-[5px] bg-surface-2 border border-border rounded-full overflow-hidden flex">
        <div className="h-full" style={{ width: `${basePct}%`, background: color, opacity: 0.4 }} />
        <div className="h-full" style={{ width: `${eqPct}%`,   background: color, opacity: 0.75 }} />
        <div className="h-full" style={{ width: `${cardPct}%`, background: color }} />
      </div>
      {(equipBonus > 0 || cardBonus > 0) && (
        <div className="flex gap-2">
          {equipBonus > 0 && <span className="text-[10px] text-text-3">⚔ equipo <span style={{ color }}>+{equipBonus}</span></span>}
          {cardBonus  > 0 && <span className="text-[10px] text-text-3">✦ cartas <span style={{ color }}>+{cardBonus}</span></span>}
        </div>
      )}
    </div>
  )
}

/* ─── Componente principal ───────────────────────────────────────────────────── */

export default function Equipo() {
  const heroId = useHeroId()
  const { hero }  = useHero(heroId)
  const { items } = useInventory(heroId)
  const { cards } = useHeroCards(heroId)

  const equippedBySlot = useMemo(() => {
    if (!items) return {}
    return Object.fromEntries(
      items.filter(i => i.equipped_slot).map(i => [i.equipped_slot, i])
    )
  }, [items])

  const unequipped = useMemo(() => (items ?? []).filter(i => !i.equipped_slot), [items])

  const equipBonus = useMemo(() => {
    const b = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0, max_hp: 0 }
    ;(items ?? []).filter(i => i.equipped_slot && i.current_durability > 0).forEach(i => {
      const c = i.item_catalog
      b.attack       += c.attack_bonus       ?? 0
      b.defense      += c.defense_bonus      ?? 0
      b.strength     += c.strength_bonus     ?? 0
      b.agility      += c.agility_bonus      ?? 0
      b.intelligence += c.intelligence_bonus ?? 0
      b.max_hp       += c.hp_bonus           ?? 0
    })
    return b
  }, [items])

  const cardBonus = useMemo(() => {
    const b = { attack: 0, defense: 0, strength: 0, agility: 0, intelligence: 0, max_hp: 0 }
    ;(cards ?? []).filter(c => c.equipped).forEach(c => {
      const sc = c.skill_cards
      const r  = Math.min(c.rank, 20)
      b.attack       += (sc.attack_bonus       ?? 0) * r
      b.defense      += (sc.defense_bonus      ?? 0) * r
      b.strength     += (sc.strength_bonus     ?? 0) * r
      b.agility      += (sc.agility_bonus      ?? 0) * r
      b.intelligence += (sc.intelligence_bonus ?? 0) * r
      b.max_hp       += (sc.hp_bonus           ?? 0) * r
    })
    return b
  }, [cards])

  if (!hero) {
    return (
      <div className="flex items-center justify-center h-40 text-text-3 text-[13px]">
        Selecciona un héroe
      </div>
    )
  }

  const currentHp    = interpolateHp(hero, Date.now())
  const equippedCount = Object.keys(equippedBySlot).length

  return (
    <div className="flex flex-col gap-6">

      {/* Hero header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="w-11 h-11 rounded-full bg-[var(--blue-100)] border-2 border-[var(--blue-300)] flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_var(--blue-200)]">
          <span className="text-[19px] font-black text-[var(--blue-700)]">
            {(hero.name ?? '?')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[17px] font-bold text-text">{hero.name}</span>
            <span className="text-[11px] font-semibold text-text-3 bg-surface-2 border border-border px-2 py-0.5 rounded-full">
              Nv. {hero.level}
            </span>
          </div>
          <span className="text-[12px] text-text-3">
            {equippedCount}/8 piezas · {currentHp}/{hero.max_hp} HP
          </span>
        </div>
      </div>

      {/* Main grid — stats arriba en mobile, slots a la izquierda en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">

        {/* Stats — order-1 mobile (arriba), order-2 desktop (derecha) */}
        <div className="flex flex-col gap-2 order-1 lg:order-2">
          <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Estadísticas</p>
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
            {STAT_CONFIG.map(({ key, label, color, Icon }) => (
              <StatRow key={key} statKey={key} label={label} color={color} Icon={Icon}
                base={hero[key] ?? 0} equipBonus={equipBonus[key] ?? 0} cardBonus={cardBonus[key] ?? 0}
              />
            ))}
          </div>
        </div>

        {/* Slots — order-2 mobile (abajo), order-1 desktop (izquierda) */}
        <div className="flex flex-col gap-2 order-2 lg:order-1">
          <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Equipamiento</p>
          <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_SLOTS.map(slot => (
                <EquipmentSlot key={slot} slotKey={slot} item={equippedBySlot[slot] ?? null} />
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Inventory */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-text-3 uppercase tracking-wider">Mochila</p>
          {unequipped.length > 0 && <span className="text-[11px] text-text-3">{unequipped.length} items</span>}
        </div>

        {unequipped.length === 0 ? (
          <div className="flex items-center justify-center gap-2 h-20 text-[13px] text-text-3 border border-dashed border-border rounded-xl bg-surface">
            <Backpack size={14} strokeWidth={1.8} />
            Mochila vacía
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-sm)]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {unequipped.map(item => {
                const cat      = item.item_catalog
                const rarColor = RARITY_COLORS[cat.rarity] ?? '#6b7280'
                return (
                  <div key={item.id} className="flex flex-col gap-1.5 p-3 rounded-xl border border-border bg-surface-2 hover:border-[color:var(--blue-400)] transition-all duration-150 cursor-pointer">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[12px] font-semibold truncate" style={{ color: rarColor }}>{cat.name}</span>
                      <span className="text-[10px] font-bold text-text-3 bg-surface border border-border rounded px-1 flex-shrink-0">T{cat.tier}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {cat.attack_bonus       > 0 && <span className="text-[10px] text-[#d97706] font-medium">+{cat.attack_bonus} Atq</span>}
                      {cat.defense_bonus      > 0 && <span className="text-[10px] text-[#6b7280] font-medium">+{cat.defense_bonus} Def</span>}
                      {cat.hp_bonus           > 0 && <span className="text-[10px] text-[#dc2626] font-medium">+{cat.hp_bonus} HP</span>}
                      {cat.strength_bonus     > 0 && <span className="text-[10px] text-[#dc2626] font-medium">+{cat.strength_bonus} Fue</span>}
                      {cat.agility_bonus      > 0 && <span className="text-[10px] text-[#2563eb] font-medium">+{cat.agility_bonus} Agi</span>}
                      {cat.intelligence_bonus > 0 && <span className="text-[10px] text-[#7c3aed] font-medium">+{cat.intelligence_bonus} Int</span>}
                    </div>
                    <DurabilityBar current={item.current_durability} max={cat.max_durability} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
