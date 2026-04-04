import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import {
  Sword, Shield, Heart, Dumbbell, Wind, Brain, CircleDot,
  Crown, Shirt, Hand, Move, Gem, Trash2, ArrowUpDown, Backpack, X,
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

/* ─── Main component ──────────────────────────────────────────────────────────── */

function Hero({ userId }) {
  const { hero, loading: heroLoading, refetch: refetchHero } = useHero(userId)
  const { items, loading: invLoading, refetch: refetchInv } = useInventory(hero?.id)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bagOpen, setBagOpen] = useState(false)

  if (heroLoading || invLoading) return <div className="hero-loading">Cargando héroe...</div>
  if (!hero) return <div className="hero-loading">No se encontró el héroe.</div>

  const cls = hero.classes
  const status = STATUS_META[hero.status] ?? STATUS_META.idle

  const equipped = EQUIPMENT_SLOTS.reduce((acc, slot) => {
    acc[slot] = items?.find(i => i.equipped_slot === slot) ?? null
    return acc
  }, {})

  // Stats efectivas: base del héroe + bonos del equipo equipado con durabilidad > 0
  const bonuses = (items ?? [])
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

  const effective = {
    attack:       hero.attack       + bonuses.attack,
    defense:      hero.defense      + bonuses.defense,
    max_hp:       hero.max_hp       + bonuses.max_hp,
    strength:     hero.strength     + bonuses.strength,
    agility:      hero.agility      + bonuses.agility,
    intelligence: hero.intelligence + bonuses.intelligence,
  }

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

  function handleEquip(itemId)   { callApi('/api/item-equip',   { itemId, equip: true  }) }
  function handleUnequip(itemId) { callApi('/api/item-equip',   { itemId, equip: false }) }
  function handleRepair(itemId)  { callApi('/api/item-repair',  { itemId }) }
  function handleDiscard(itemId) {
    if (!confirm('¿Descartar este item? Esta acción no se puede deshacer.')) return
    callApi('/api/item-discard', { itemId })
  }

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
    </div>
  )
}

export default Hero
