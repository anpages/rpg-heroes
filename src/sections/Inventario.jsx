import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHero } from '../hooks/useHero'
import { useInventory } from '../hooks/useInventory'
import { Crown, Shirt, Hand, Move, Wind, Sword, Shield, Gem, Trash2, ArrowUpDown } from 'lucide-react'
import './Inventario.css'

const SLOT_META = {
  helmet:    { label: 'Casco',           icon: Crown },
  chest:     { label: 'Torso',           icon: Shirt },
  arms:      { label: 'Brazos',          icon: Hand },
  legs:      { label: 'Piernas',         icon: Move },
  feet:      { label: 'Pies',            icon: Wind },
  main_hand: { label: 'Arma Principal',  icon: Sword },
  off_hand:  { label: 'Mano Secundaria', icon: Shield },
  accessory: { label: 'Complemento',     icon: Gem },
}

const RARITY_META = {
  common:    { label: 'Común',       color: '#6b7280' },
  uncommon:  { label: 'Poco Común',  color: '#16a34a' },
  rare:      { label: 'Raro',        color: '#2563eb' },
  epic:      { label: 'Épico',       color: '#7c3aed' },
  legendary: { label: 'Legendario',  color: '#d97706' },
}

const EQUIPMENT_SLOTS = ['helmet', 'chest', 'arms', 'legs', 'feet', 'main_hand', 'off_hand', 'accessory']
const INVENTORY_BASE_LIMIT = 20
const INVENTORY_PER_WORKSHOP_LEVEL = 5

function durabilityColor(pct) {
  if (pct > 60) return '#16a34a'
  if (pct > 30) return '#d97706'
  return '#dc2626'
}

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

function DurabilityBar({ current, max }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  const color = durabilityColor(pct)
  return (
    <div className="inv-dur-wrap">
      <div className="inv-dur-track">
        <div className="inv-dur-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="inv-dur-label" style={{ color }}>{current}/{max}</span>
    </div>
  )
}

function EquipmentSlot({ slot, equippedItem, onToggle, loading }) {
  const meta = SLOT_META[slot]
  const Icon = meta.icon
  const catalog = equippedItem?.item_catalog
  const rarity = catalog ? RARITY_META[catalog.rarity] : null
  const durPct = equippedItem
    ? Math.round((equippedItem.current_durability / catalog.max_durability) * 100)
    : 100

  return (
    <div className={`eq-slot ${equippedItem ? 'eq-slot--filled' : ''} ${equippedItem && durPct === 0 ? 'eq-slot--broken' : ''}`}>
      <div className="eq-slot-header">
        <Icon size={14} strokeWidth={1.8} className="eq-slot-icon" />
        <span className="eq-slot-label">{meta.label}</span>
      </div>
      {equippedItem ? (
        <>
          <p className="eq-item-name" style={{ color: rarity?.color }}>{catalog.name}</p>
          <DurabilityBar current={equippedItem.current_durability} max={catalog.max_durability} />
          <button
            className="eq-unequip-btn"
            onClick={() => onToggle(equippedItem.id, false)}
            disabled={loading}
          >
            Desequipar
          </button>
        </>
      ) : (
        <p className="eq-slot-empty">Vacío</p>
      )}
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
        <button
          className="bag-discard-btn"
          onClick={() => onDiscard(item.id)}
          disabled={loading}
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

function Inventario({ userId }) {
  const { hero, loading: heroLoading } = useHero(userId)
  const { items, loading: invLoading, refetch } = useInventory(hero?.id)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)

  if (heroLoading || invLoading) return <div className="inv-loading">Cargando inventario...</div>

  const equipped = EQUIPMENT_SLOTS.reduce((acc, slot) => {
    acc[slot] = items?.find(i => i.equipped_slot === slot) ?? null
    return acc
  }, {})

  const bag = items?.filter(i => !i.equipped_slot) ?? []
  const bagLimit = INVENTORY_BASE_LIMIT // TODO: workshop bonus when available
  const bagUsed = bag.length

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
    else refetch()
  }

  function handleEquip(itemId)   { callApi('/api/item-equip',   { itemId, equip: true  }) }
  function handleUnequip(itemId) { callApi('/api/item-equip',   { itemId, equip: false }) }
  function handleDiscard(itemId) {
    if (!confirm('¿Descartar este item? Esta acción no se puede deshacer.')) return
    callApi('/api/item-discard', { itemId })
  }

  return (
    <div className="inv-section">
      <div className="section-header">
        <h2 className="section-title">Inventario</h2>
        <p className="section-subtitle">Gestiona el equipo de tu héroe.</p>
      </div>

      {error && <p className="inv-error">{error}</p>}

      <div className="inv-layout">
        {/* Panel de equipo */}
        <div className="inv-equipment">
          <p className="inv-panel-title">Equipo</p>
          <div className="eq-slots-grid">
            {EQUIPMENT_SLOTS.map(slot => (
              <EquipmentSlot
                key={slot}
                slot={slot}
                equippedItem={equipped[slot]}
                onToggle={handleUnequip}
                loading={actionLoading}
              />
            ))}
          </div>
        </div>

        {/* Mochila */}
        <div className="inv-bag">
          <p className="inv-panel-title">
            Mochila
            <span className="inv-bag-count">{bagUsed} / {bagLimit}</span>
          </p>
          {bag.length === 0 ? (
            <p className="inv-bag-empty">La mochila está vacía. Explora mazmorras para conseguir equipo.</p>
          ) : (
            <div className="bag-grid">
              {bag.map(item => (
                <BagItem
                  key={item.id}
                  item={item}
                  onEquip={handleEquip}
                  onDiscard={handleDiscard}
                  loading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Inventario
