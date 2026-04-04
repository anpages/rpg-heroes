import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { useHeroCards } from '../hooks/useHeroCards'
import {
  Sword, Shield, Heart, Dumbbell, Wind, Brain, CircleDot,
  Crown, Shirt, Hand, Move, Gem, Trash2, ArrowUpDown, Backpack, X,
  BookOpen, Zap, FlameKindling,
} from 'lucide-react'
import './Hero.css'

/* ─── Hero status ─────────────────────────────────────────────────────────────── */

const STATUS_META = {
  idle:      { label: 'En reposo',   color: '#16a34a' },
  exploring: { label: 'Explorando',  color: '#d97706' },
  resting:   { label: 'Recuperando', color: '#0369a1' },
}

/* ─── Inventory constants ─────────────────────────────────────────────────────── */

const SLOT_META = {
  helmet:    { label: 'Casco',           icon: Crown  },
  chest:     { label: 'Torso',           icon: Shirt  },
  arms:      { label: 'Brazos',          icon: Hand   },
  legs:      { label: 'Piernas',         icon: Move   },
  main_hand: { label: 'Arma Principal',  icon: Sword  },
  off_hand:  { label: 'Mano Secundaria', icon: Shield },
  accessory:   { label: 'Complemento',   icon: Gem    },
  accessory_2: { label: 'Complemento 2', icon: Gem    },
}

const RARITY_META = {
  common:    { label: 'Común',      color: '#6b7280' },
  uncommon:  { label: 'Poco Común', color: '#16a34a' },
  rare:      { label: 'Raro',       color: '#2563eb' },
  epic:      { label: 'Épico',      color: '#7c3aed' },
  legendary: { label: 'Legendario', color: '#d97706' },
}

const EQUIPMENT_SLOTS = ['helmet', 'chest', 'arms', 'legs', 'main_hand', 'off_hand', 'accessory', 'accessory_2']
const INVENTORY_BASE_LIMIT = 20

/* ─── Shared sub-components ───────────────────────────────────────────────────── */

function XpBar({ level, experience }) {
  const needed = level * 150
  const pct = Math.min(100, Math.round((experience / needed) * 100))
  return (
    <div className="xp-bar-wrap">
      <div className="xp-bar-labels">
        <span>Nivel {level}</span>
        <span>{experience} / {needed} XP</span>
      </div>
      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StatRow({ icon: Icon, label, value, color, bonus }) {
  return (
    <div className="stat-row">
      <div className="stat-icon" style={{ color }}>
        <Icon size={16} strokeWidth={1.8} />
      </div>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {bonus > 0 && <span className="stat-bonus">+{bonus}</span>}
      </span>
    </div>
  )
}

function HpBar({ current, max }) {
  const pct = Math.min(100, Math.round((current / max) * 100))
  const color = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
  return (
    <div className="hp-bar-wrap">
      <div className="hp-bar-labels">
        <span className="hp-label"><Heart size={13} strokeWidth={2} color={color} /> HP</span>
        <span className="hp-value">{current} / {max}</span>
      </div>
      <div className="hp-track">
        <div className="hp-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function DurabilityBar({ current, max }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  const color = pct > 60 ? '#16a34a' : pct > 30 ? '#d97706' : '#dc2626'
  return (
    <div className="inv-dur-wrap">
      <div className="inv-dur-track">
        <div className="inv-dur-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="inv-dur-label" style={{ color }}>{current}/{max}</span>
    </div>
  )
}

/* ─── Equipment slot (panel lateral) ─────────────────────────────────────────── */

function EquipmentSlot({ slot, item, onUnequip, onRepair, loading }) {
  const meta = SLOT_META[slot]
  const Icon = meta.icon
  const catalog = item?.item_catalog
  const rarity = catalog ? RARITY_META[catalog.rarity] : null
  const durPct = item ? Math.round((item.current_durability / catalog.max_durability) * 100) : 100

  const isCritical = item && durPct > 0 && durPct <= 25
  const isBroken   = item && durPct === 0
  const needsRepair = item && durPct < 100

  return (
    <div className={`eq-slot ${item ? 'eq-slot--filled' : ''} ${isCritical ? 'eq-slot--critical' : ''} ${isBroken ? 'eq-slot--broken' : ''}`}>
      <div className="eq-slot-header">
        <Icon size={13} strokeWidth={1.8} className="eq-slot-icon" />
        <span className="eq-slot-label">{meta.label}</span>
        {isBroken   && <span className="eq-slot-status eq-slot-status--broken">Roto</span>}
        {isCritical && <span className="eq-slot-status eq-slot-status--critical">Crítico</span>}
      </div>
      {item ? (
        <>
          <p className="eq-item-name" style={{ color: rarity?.color }}>{catalog.name}</p>
          <DurabilityBar current={item.current_durability} max={catalog.max_durability} />
          <div className="eq-slot-actions">
            {needsRepair && (
              <button className="eq-repair-btn" onClick={() => onRepair(item.id)} disabled={loading}>
                Reparar
              </button>
            )}
            <button className="eq-unequip-btn" onClick={() => onUnequip(item.id)} disabled={loading}>
              Desequipar
            </button>
          </div>
        </>
      ) : (
        <p className="eq-slot-empty">Vacío</p>
      )}
    </div>
  )
}

/* ─── Bag item (modal) ────────────────────────────────────────────────────────── */

function StatsList({ catalog }) {
  const stats = [
    { key: 'attack_bonus',       label: 'Atq' },
    { key: 'defense_bonus',      label: 'Def' },
    { key: 'hp_bonus',           label: 'HP'  },
    { key: 'strength_bonus',     label: 'Fue' },
    { key: 'agility_bonus',      label: 'Agi' },
    { key: 'intelligence_bonus', label: 'Int' },
  ].filter(s => catalog[s.key] > 0)

  if (!stats.length) return <span className="inv-no-stats">Sin bonificaciones</span>
  return (
    <div className="inv-stats">
      {stats.map(s => (
        <span key={s.key} className="inv-stat">+{catalog[s.key]} {s.label}</span>
      ))}
    </div>
  )
}

function BagItem({ item, onEquip, onDiscard, loading }) {
  const catalog = item.item_catalog
  const rarity = RARITY_META[catalog.rarity]
  const slotMeta = SLOT_META[catalog.slot]
  const durPct = Math.round((item.current_durability / catalog.max_durability) * 100)

  return (
    <div className="bag-item">
      <div className="bag-item-header">
        <span className="bag-item-name" style={{ color: rarity.color }}>{catalog.name}</span>
        <span className="bag-item-tier">T{catalog.tier}</span>
      </div>
      <div className="bag-item-meta">
        <span className="bag-item-rarity" style={{ color: rarity.color }}>{rarity.label}</span>
        <span className="bag-item-slot">{slotMeta.label}</span>
        {catalog.is_two_handed && <span className="bag-item-2h">2 manos</span>}
      </div>
      <StatsList catalog={catalog} />
      <DurabilityBar current={item.current_durability} max={catalog.max_durability} />
      <div className="bag-item-actions">
        <button
          className="bag-equip-btn"
          onClick={() => onEquip(item.id)}
          disabled={loading || durPct === 0}
          title={durPct === 0 ? 'Repara el item antes de equiparlo' : ''}
        >
          <ArrowUpDown size={13} strokeWidth={2} />
          Equipar
        </button>
        <button className="bag-discard-btn" onClick={() => onDiscard(item.id)} disabled={loading}>
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

/* ─── Bag modal ───────────────────────────────────────────────────────────────── */

function BagModal({ bag, bagLimit, onEquip, onDiscard, loading, error, onClose }) {
  return (
    <div className="bag-modal-overlay" onClick={onClose}>
      <div className="bag-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="bag-modal-header">
          <div className="bag-modal-title-wrap">
            <Backpack size={18} strokeWidth={1.8} />
            <span className="bag-modal-title">Mochila</span>
            <span className="bag-modal-count">{bag.length} / {bagLimit}</span>
          </div>
          <button className="bag-modal-close" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {error && <p className="inv-error">{error}</p>}

        {bag.length === 0 ? (
          <p className="inv-bag-empty">La mochila está vacía. Explora mazmorras para conseguir equipo.</p>
        ) : (
          <div className="bag-grid">
            {bag.map(item => (
              <BagItem
                key={item.id}
                item={item}
                onEquip={onEquip}
                onDiscard={onDiscard}
                loading={loading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Card constants ──────────────────────────────────────────────────────────── */

const CATEGORY_META = {
  strength:     { label: 'Fuerza',        color: '#dc2626', icon: Dumbbell },
  agility:      { label: 'Agilidad',      color: '#0369a1', icon: Wind     },
  intelligence: { label: 'Inteligencia',  color: '#7c3aed', icon: Brain    },
}

/* ─── Card budget bar ─────────────────────────────────────────────────────────── */

function CardBudgetBar({ category, used, total }) {
  const meta = CATEGORY_META[category]
  const Icon = meta.icon
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const over = used > total
  return (
    <div className="card-budget">
      <div className="card-budget-header">
        <span className="card-budget-label" style={{ color: meta.color }}>
          <Icon size={11} strokeWidth={2} /> {meta.label}
        </span>
        <span className={`card-budget-nums ${over ? 'card-budget-nums--over' : ''}`}>{used}/{total}</span>
      </div>
      <div className="card-budget-track">
        <div className="card-budget-fill" style={{ width: `${pct}%`, background: over ? '#dc2626' : meta.color }} />
      </div>
    </div>
  )
}

/* ─── Equipped card chip ──────────────────────────────────────────────────────── */

function CardChip({ card, onUnequip, loading }) {
  const sc = card.skill_cards
  const meta = CATEGORY_META[sc.category]
  return (
    <div className="card-chip" style={{ '--card-color': meta.color }}>
      <div className="card-chip-top">
        <span className="card-chip-name">{sc.name}</span>
        <span className="card-chip-rank">R{card.rank}</span>
      </div>
      <div className="card-chip-meta">
        <span className="card-chip-category" style={{ color: meta.color }}>{meta.label}</span>
        <span className="card-chip-cost">{sc.base_cost * card.rank} pts</span>
      </div>
      <button className="card-chip-unequip" onClick={() => onUnequip(card.id)} disabled={loading}>
        Desequipar
      </button>
    </div>
  )
}

/* ─── Card collection modal ───────────────────────────────────────────────────── */

function CardItem({ card, canEquip, canFuseWith, onEquip, onUnequip, onFuse, loading }) {
  const sc = card.skill_cards
  const meta = CATEGORY_META[sc.category]
  const Icon = meta.icon
  const effects = [
    sc.attack_bonus       > 0 && `+${sc.attack_bonus * card.rank} Atq`,
    sc.defense_bonus      > 0 && `+${sc.defense_bonus * card.rank} Def`,
    sc.hp_bonus           > 0 && `+${sc.hp_bonus * card.rank} HP`,
    sc.strength_bonus     > 0 && `+${sc.strength_bonus * card.rank} Fue`,
    sc.agility_bonus      > 0 && `+${sc.agility_bonus * card.rank} Agi`,
    sc.intelligence_bonus > 0 && `+${sc.intelligence_bonus * card.rank} Int`,
  ].filter(Boolean)

  return (
    <div className={`card-item ${card.equipped ? 'card-item--equipped' : ''}`} style={{ '--card-color': meta.color }}>
      <div className="card-item-header">
        <span className="card-item-name">{sc.name}</span>
        <div className="card-item-badges">
          <span className="card-item-rank">R{card.rank}</span>
          {canFuseWith && <span className="card-item-fuseable"><FlameKindling size={10} strokeWidth={2} /></span>}
        </div>
      </div>
      <div className="card-item-meta">
        <span className="card-item-category" style={{ color: meta.color }}>
          <Icon size={10} strokeWidth={2} /> {meta.label}
        </span>
        <span className="card-item-cost">{sc.base_cost * card.rank} pts · {sc.rarity}</span>
      </div>
      {sc.description && <p className="card-item-desc">{sc.description}</p>}
      <div className="card-item-effects">
        {effects.map(e => <span key={e} className="card-item-effect">{e}</span>)}
      </div>
      <div className="card-item-actions">
        {canFuseWith && !card.equipped && (
          <button className="card-fuse-btn" onClick={() => onFuse(card.id, canFuseWith.id)} disabled={loading}>
            <FlameKindling size={12} strokeWidth={2} /> Fusionar · {sc.base_mana_fuse * Math.pow(2, card.rank - 1)} maná
          </button>
        )}
        {card.equipped ? (
          <button className="card-unequip-btn" onClick={() => onUnequip(card.id)} disabled={loading}>Desequipar</button>
        ) : (
          <button className="card-equip-btn" onClick={() => onEquip(card.id)} disabled={loading || !canEquip}>
            Equipar
          </button>
        )}
      </div>
    </div>
  )
}

function CardModal({ cards, hero, cardSlots, onEquip, onUnequip, onFuse, loading, error, onClose }) {
  const equippedCount = cards.filter(c => c.equipped).length

  // Detectar cartas fusionables: misma card_id y mismo rango, sin equipar
  const fuseMap = {}
  cards.filter(c => !c.equipped).forEach(c => {
    const key = `${c.card_id}-${c.rank}`
    if (!fuseMap[key]) fuseMap[key] = []
    fuseMap[key].push(c)
  })

  // Presupuesto usado por categoría (para saber si puede equipar)
  const budgetUsed = { strength: 0, agility: 0, intelligence: 0 }
  cards.filter(c => c.equipped).forEach(c => {
    budgetUsed[c.skill_cards.category] += c.skill_cards.base_cost * c.rank
  })

  return (
    <div className="bag-modal-overlay" onClick={onClose}>
      <div className="bag-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="bag-modal-header">
          <div className="bag-modal-title-wrap">
            <BookOpen size={18} strokeWidth={1.8} />
            <span className="bag-modal-title">Colección de Cartas</span>
            <span className="bag-modal-count">{cards.length} cartas · {equippedCount}/{cardSlots} equipadas</span>
          </div>
          <button className="bag-modal-close" onClick={onClose}><X size={18} strokeWidth={2} /></button>
        </div>

        {error && <p className="inv-error">{error}</p>}

        {cards.length === 0 ? (
          <p className="inv-bag-empty">Sin cartas. Explora mazmorras mágicas o antiguas para conseguirlas.</p>
        ) : (
          <div className="bag-grid">
            {cards.map(card => {
              const key = `${card.card_id}-${card.rank}`
              const fusePair = fuseMap[key]?.find(c => c.id !== card.id)
              const cat = card.skill_cards.category
              const cost = card.skill_cards.base_cost * card.rank
              const wouldFit = budgetUsed[cat] + cost <= hero[cat] && equippedCount < cardSlots
              return (
                <CardItem
                  key={card.id}
                  card={card}
                  canEquip={wouldFit}
                  canFuseWith={!card.equipped ? fusePair : null}
                  onEquip={onEquip}
                  onUnequip={onUnequip}
                  onFuse={onFuse}
                  loading={loading}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────────── */

function Hero({ userId }) {
  const { hero, loading: heroLoading, refetch: refetchHero } = useHero(userId)
  const { items, loading: invLoading, refetch: refetchInv } = useInventory(hero?.id)
  const { cards, loading: cardsLoading, refetch: refetchCards } = useHeroCards(hero?.id)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bagOpen, setBagOpen] = useState(false)
  const [cardModalOpen, setCardModalOpen] = useState(false)

  if (heroLoading || invLoading || cardsLoading) return <div className="hero-loading">Cargando héroe...</div>
  if (!hero) return <div className="hero-loading">No se encontró el héroe.</div>

  const cls = hero.classes
  const status = STATUS_META[hero.status] ?? STATUS_META.idle

  const equipped = EQUIPMENT_SLOTS.reduce((acc, slot) => {
    acc[slot] = items?.find(i => i.equipped_slot === slot) ?? null
    return acc
  }, {})

  // Bonos del equipo equipado (durabilidad > 0)
  const equipBonuses = (items ?? [])
    .filter(i => i.equipped_slot && i.current_durability > 0)
    .reduce((acc, i) => {
      const c = i.item_catalog
      acc.attack       += c.attack_bonus       ?? 0
      acc.defense      += c.defense_bonus      ?? 0
      acc.max_hp       += c.hp_bonus           ?? 0
      acc.strength     += c.strength_bonus     ?? 0
      acc.agility      += c.agility_bonus      ?? 0
      acc.intelligence += c.intelligence_bonus ?? 0
      return acc
    }, { attack: 0, defense: 0, max_hp: 0, strength: 0, agility: 0, intelligence: 0 })

  // Bonos de cartas equipadas (efectos × rango)
  const cardBonuses = (cards ?? [])
    .filter(c => c.equipped)
    .reduce((acc, c) => {
      const sc = c.skill_cards
      const r  = c.rank
      acc.attack       += (sc.attack_bonus       ?? 0) * r
      acc.defense      += (sc.defense_bonus      ?? 0) * r
      acc.max_hp       += (sc.hp_bonus           ?? 0) * r
      acc.strength     += (sc.strength_bonus     ?? 0) * r
      acc.agility      += (sc.agility_bonus      ?? 0) * r
      acc.intelligence += (sc.intelligence_bonus ?? 0) * r
      return acc
    }, { attack: 0, defense: 0, max_hp: 0, strength: 0, agility: 0, intelligence: 0 })

  const bonuses = {
    attack:       equipBonuses.attack       + cardBonuses.attack,
    defense:      equipBonuses.defense      + cardBonuses.defense,
    max_hp:       equipBonuses.max_hp       + cardBonuses.max_hp,
    strength:     equipBonuses.strength     + cardBonuses.strength,
    agility:      equipBonuses.agility      + cardBonuses.agility,
    intelligence: equipBonuses.intelligence + cardBonuses.intelligence,
  }

  const effective = {
    attack:       hero.attack       + bonuses.attack,
    defense:      hero.defense      + bonuses.defense,
    max_hp:       hero.max_hp       + bonuses.max_hp,
    strength:     hero.strength     + bonuses.strength,
    agility:      hero.agility      + bonuses.agility,
    intelligence: hero.intelligence + bonuses.intelligence,
  }

  // Presupuesto de cartas por categoría (usa stats BASE del héroe, no efectivas)
  const cardBudgetUsed = { strength: 0, agility: 0, intelligence: 0 }
  ;(cards ?? []).filter(c => c.equipped).forEach(c => {
    cardBudgetUsed[c.skill_cards.category] += c.skill_cards.base_cost * c.rank
  })
  const cardSlotCount = 3 // se sobreescribe en el modal con el nivel real de la biblioteca

  const bag = items?.filter(i => !i.equipped_slot) ?? []
  const bagLimit = INVENTORY_BASE_LIMIT

  async function callApi(endpoint, body) {
    setActionLoading(true)
    setError(null)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setActionLoading(false)
    if (!res.ok) setError(data.error ?? 'Error')
    else refetchInv()
  }

  function handleEquip(itemId)      { callApi('/api/item-equip',  { itemId, equip: true  }) }
  function handleUnequip(itemId)    { callApi('/api/item-equip',  { itemId, equip: false }) }
  function handleRepair(itemId)     { callApi('/api/item-repair', { itemId }) }
  function handleDiscard(itemId) {
    if (!confirm('¿Descartar este item? Esta acción no se puede deshacer.')) return
    callApi('/api/item-discard', { itemId })
  }

  async function callCardApi(endpoint, body) {
    setActionLoading(true)
    setError(null)
    await supabase.auth.refreshSession()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setActionLoading(false)
    if (!res.ok) setError(data.error ?? 'Error')
    else refetchCards()
  }

  function handleCardEquip(cardId)   { callCardApi('/api/card-equip', { cardId, equip: true  }) }
  function handleCardUnequip(cardId) { callCardApi('/api/card-equip', { cardId, equip: false }) }
  function handleCardFuse(id1, id2)  { callCardApi('/api/card-fuse',  { cardId1: id1, cardId2: id2 }) }

  return (
    <div className="hero-section">
      <div className="section-header">
        <h2 className="section-title">Héroe</h2>
        <p className="section-subtitle">Estadísticas y equipo de tu héroe.</p>
      </div>

      <div className="hero-layout">

        {/* Ficha del héroe */}
        <div className="hero-card">
          <div className="hero-card-header">
            <div className="hero-avatar">
              <Sword size={32} strokeWidth={1.5} color={cls?.color} />
            </div>
            <div className="hero-identity">
              <h3 className="hero-name">{hero.name}</h3>
              <div className="hero-badges">
                <span className="hero-class-badge" style={{ color: cls?.color, background: cls?.bg_color, borderColor: cls?.border_color }}>
                  {cls?.name}
                </span>
                <span className="hero-status-badge" style={{ color: status.color }}>
                  <CircleDot size={10} strokeWidth={2.5} />
                  {status.label}
                </span>
              </div>
            </div>
          </div>

          <XpBar level={hero.level} experience={hero.experience} />
          <HpBar current={hero.current_hp} max={effective.max_hp} />

          <div className="hero-stats-grid">
            <div className="hero-stats-group">
              <p className="stats-group-title">Atributos</p>
              <StatRow icon={Dumbbell} label="Fuerza"       value={effective.strength}     color="#dc2626" bonus={bonuses.strength} />
              <StatRow icon={Wind}     label="Agilidad"     value={effective.agility}      color="#0369a1" bonus={bonuses.agility} />
              <StatRow icon={Brain}    label="Inteligencia" value={effective.intelligence}  color="#7c3aed" bonus={bonuses.intelligence} />
            </div>
            <div className="hero-stats-group">
              <p className="stats-group-title">Combate</p>
              <StatRow icon={Sword}  label="Ataque"  value={effective.attack}  color="#d97706" bonus={bonuses.attack} />
              <StatRow icon={Shield} label="Defensa" value={effective.defense} color="#475569" bonus={bonuses.defense} />
            </div>
          </div>
        </div>

        {/* Panel de equipo */}
        <div className="hero-equipment-panel">
          <div className="hero-eq-header">
            <p className="hero-eq-title">Equipo</p>
            <button className="hero-bag-btn" onClick={() => setBagOpen(true)}>
              <Backpack size={13} strokeWidth={2} />
              Mochila {bag.length}/{bagLimit}
            </button>
          </div>

          {error && !bagOpen && <p className="inv-error">{error}</p>}

          {/* Armadura */}
          <div className="eq-group eq-group--armor">
            <div className="eq-group-header">
              <Shield size={11} strokeWidth={2.5} className="eq-group-icon" />
              <span className="eq-group-name">Armadura</span>
            </div>
            <div className="eq-slots-grid">
              {['helmet', 'chest', 'arms', 'legs'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onUnequip={handleUnequip} onRepair={handleRepair} loading={actionLoading} />
              ))}
            </div>
          </div>

          {/* Armas */}
          <div className="eq-group eq-group--weapons">
            <div className="eq-group-header">
              <Sword size={11} strokeWidth={2.5} className="eq-group-icon" />
              <span className="eq-group-name">Armas</span>
            </div>
            <div className="eq-slots-grid eq-slots-grid--2">
              {['main_hand', 'off_hand'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onUnequip={handleUnequip} onRepair={handleRepair} loading={actionLoading} />
              ))}
            </div>
          </div>

          {/* Complemento */}
          <div className="eq-group eq-group--accessory">
            <div className="eq-group-header">
              <Gem size={11} strokeWidth={2.5} className="eq-group-icon" />
              <span className="eq-group-name">Complemento</span>
            </div>
            <div className="eq-slots-grid eq-slots-grid--2">
              {['accessory', 'accessory_2'].map(slot => (
                <EquipmentSlot key={slot} slot={slot} item={equipped[slot]} onUnequip={handleUnequip} onRepair={handleRepair} loading={actionLoading} />
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Panel de cartas */}
      <div className="hero-cards-section">
        <div className="hero-cards-header">
          <p className="hero-cards-title">
            <BookOpen size={14} strokeWidth={2} />
            Cartas de Habilidad
          </p>
          <button className="hero-bag-btn" onClick={() => setCardModalOpen(true)}>
            <Zap size={13} strokeWidth={2} />
            Colección {(cards ?? []).length}
          </button>
        </div>

        <div className="card-budgets">
          {['strength', 'agility', 'intelligence'].map(cat => (
            <CardBudgetBar
              key={cat}
              category={cat}
              used={cardBudgetUsed[cat]}
              total={hero[cat]}
            />
          ))}
        </div>

        {(cards ?? []).filter(c => c.equipped).length === 0 ? (
          <p className="hero-cards-empty">Sin cartas equipadas. Abre la colección para equipar.</p>
        ) : (
          <div className="equipped-cards-grid">
            {(cards ?? []).filter(c => c.equipped).map(card => (
              <CardChip key={card.id} card={card} onUnequip={handleCardUnequip} loading={actionLoading} />
            ))}
          </div>
        )}
      </div>

      {bagOpen && (
        <BagModal
          bag={bag}
          bagLimit={bagLimit}
          onEquip={handleEquip}
          onDiscard={handleDiscard}
          loading={actionLoading}
          error={error}
          onClose={() => setBagOpen(false)}
        />
      )}

      {cardModalOpen && (
        <CardModal
          cards={cards ?? []}
          hero={hero}
          cardSlots={cardSlotCount}
          onEquip={handleCardEquip}
          onUnequip={handleCardUnequip}
          onFuse={handleCardFuse}
          loading={actionLoading}
          error={error}
          onClose={() => { setCardModalOpen(false); setError(null) }}
        />
      )}
    </div>
  )
}

export default Hero
