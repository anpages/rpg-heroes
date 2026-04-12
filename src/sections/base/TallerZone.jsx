import { useState, useEffect, useReducer } from 'react'
import { Lock, Clock, Package, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { LAB_BASE_LEVEL_REQUIRED, LAB_INVENTORY_BASE, LAB_INVENTORY_PER_UPGRADE, CRAFTING_SLOTS_BASE } from '../../lib/gameConstants.js'
import { cardVariants, BUILDING_META } from './constants.js'
import { baseLevelFromMap } from './helpers.js'
import { BuildingCard } from './BuildingCard.jsx'
import { LaboratorySection, LabInventory } from './LaboratorySection.jsx'
import ScrollHint from '../../components/ScrollHint'

const CRAFT_TABS = [
  { id: 'items',    label: 'Crafteo' },
  { id: 'potions',  label: 'Pociones' },
]

const CATEGORY_LABELS = {
  repair:   'Reparación',
  upgrade:  'Mejora',
  tactic:   'Tácticas',
  training: 'Entrenamiento',
}

const INPUT_LABELS = {
  iron: 'Hierro', wood: 'Madera', mana: 'Maná', herbs: 'Hierbas',
  coal: 'Carbón', fiber: 'Fibra', arcane_dust: 'Polvo Arcano', flowers: 'Flores',
  fragments: 'Fragmentos', essence: 'Esencia',
  // Item (crafted material) labels
  steel_ingot: 'Lingote', plank: 'Tablón', mana_crystal: 'Cristal', herbal_extract: 'Extracto',
  tempered_steel: 'Acero Templ.', composite_wood: 'Madera Comp.', concentrated_mana: 'Maná Conc.', potion_base: 'Base Poción',
}

/**
 * Zona del Taller: crafteo de items (kits, piedras, pergaminos) + pociones.
 */
export default function TallerZone({
  byType, effectiveResources,
  // Crafted items
  catalog, inventory, queue,
  craftItemPending, collectItemPending,
  onCraftItem, onCollectItem,
  // Potions (existing system)
  potions, potionCraftingMap,
  craftPotionPending, collectPotionPending,
  onCraftPotion, onCollectPotion,
  onLabInventoryUpgrade, labInventoryUpgradePending,
  // Building upgrade
  anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending,
}) {
  const [tab, setTab] = useState('items')
  const lab       = byType['laboratory']
  const baseLevel = baseLevelFromMap(byType)
  const labLevel  = lab?.level ?? 0

  // Lab capacity for potions
  const labUpgrades      = effectiveResources?.lab_inventory_upgrades ?? 0
  const labCapacity      = LAB_INVENTORY_BASE + labUpgrades * LAB_INVENTORY_PER_UPGRADE
  const potionQty        = (potions ?? []).reduce((s, p) => s + (p.quantity ?? 0), 0)
  const potionCraftCount = Object.values(potionCraftingMap ?? {}).reduce((s, arr) => s + (arr?.length ?? 0), 0)
  const labInventoryUsed = potionQty + potionCraftCount
  const labInventoryFull = labInventoryUsed >= labCapacity

  if (!lab) return null

  // Locked state
  if (lab.level === 0 && !lab.upgrade_ends_at && baseLevel < LAB_BASE_LEVEL_REQUIRED) {
    const meta = BUILDING_META['laboratory']
    const Icon = meta.icon
    return (
      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <div
          className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] opacity-60"
          style={{ '--accent': meta.color }}
        >
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
              <Icon size={18} strokeWidth={1.8} color={meta.color} />
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-text truncate">{meta.name}</h3>
              <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 py-3 border-y border-border bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg))]">
            <p className="text-[13px] text-text-3 text-center">{meta.description}</p>
          </div>
          <div className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3">
              <Lock size={11} strokeWidth={2.5} />
              Requiere base nivel {LAB_BASE_LEVEL_REQUIRED} para construir.
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <BuildingCard
        building={lab}
        resources={effectiveResources}
        anyUpgrading={anyUpgrading}
        onUpgradeStart={onUpgradeStart}
        onUpgradeCollect={onUpgradeCollect}
        onOptimisticDeduct={onOptimisticDeduct}
        onUpgradePending={onUpgradePending}
      />

      {labLevel >= 1 && (
        <>
          {/* Slots de crafteo — solo items del Taller (building_type null) */}
          {(() => {
            const tallerQueue = (queue ?? []).filter(q => !q.building_type)
            return (
              <>
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">
                    Slots de crafteo: {tallerQueue.length}/{CRAFTING_SLOTS_BASE}
                  </span>
                  {tallerQueue.length >= CRAFTING_SLOTS_BASE && (
                    <span className="text-[10px] font-semibold text-[#d97706]">Cola llena</span>
                  )}
                </div>
                <CraftingQueue queue={tallerQueue} collectPending={collectItemPending} onCollect={onCollectItem} catalog={catalog} />
              </>
            )
          })()}

          {/* Tabs */}
          <div className="border-b border-border">
            <ScrollHint>
              {CRAFT_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="px-3 py-2 text-[13px] font-semibold whitespace-nowrap flex-shrink-0 border-b-2 border-x-0 border-t-0 transition-[color,border-color] duration-150 bg-transparent font-[inherit]"
                  style={{
                    borderBottomColor: tab === t.id ? '#7c3aed' : 'transparent',
                    color: tab === t.id ? '#7c3aed' : 'var(--text-3)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </ScrollHint>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {tab === 'items' && (
                <CraftingCatalog
                  catalog={(catalog ?? []).filter(c => c.category !== 'refining')}
                  inventory={inventory}
                  labLevel={labLevel}
                  resources={effectiveResources}
                  craftPending={craftItemPending}
                  queueLength={(queue ?? []).filter(q => !q.building_type).length}
                  onCraft={onCraftItem}
                />
              )}

              {tab === 'potions' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-surface border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
                    <LabInventory
                      potions={potions}
                      resources={effectiveResources}
                      onUpgrade={onLabInventoryUpgrade}
                      upgradePending={labInventoryUpgradePending}
                      potionCraftingMap={potionCraftingMap}
                      onPotionCollect={onCollectPotion}
                      potionCollectPending={collectPotionPending}
                      inventoryUsed={labInventoryUsed}
                      capacity={labCapacity}
                    />
                  </div>
                  <div className="bg-surface border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
                    <LaboratorySection
                      labLevel={labLevel}
                      potions={potions}
                      craftingMap={potionCraftingMap}
                      craftPending={craftPotionPending}
                      resources={effectiveResources}
                      craftedItems={inventory}
                      onCraft={onCraftPotion}
                      isUpgrading={!!lab.upgrade_ends_at}
                      inventoryFull={labInventoryFull}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

/* ── Cola de crafteo ──────────────────────────────────────────────────────────── */

function CraftingQueue({ queue, collectPending, onCollect, catalog }) {
  if (!queue?.length) return null

  const catalogMap = Object.fromEntries((catalog ?? []).map(c => [c.id, c]))

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">En proceso</span>
      <div className="flex flex-col gap-1.5">
        {queue.map(craft => {
          const recipe = catalogMap[craft.recipe_id]
          const ready = new Date(craft.craft_ends_at) <= new Date()
          return (
            <div key={craft.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-surface border border-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px]">{recipe?.icon ?? '🔧'}</span>
                <span className="text-[12px] font-semibold text-text-2 truncate">
                  {recipe?.name ?? craft.recipe_id}
                </span>
              </div>
              {ready ? (
                <motion.button
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md border-0 text-white bg-emerald-600 disabled:opacity-50"
                  onClick={() => onCollect(craft.id)}
                  disabled={collectPending}
                  whileTap={{ scale: 0.95 }}
                >
                  <Check size={10} strokeWidth={3} />
                  Recoger
                </motion.button>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-text-3 font-medium flex-shrink-0">
                  <Clock size={10} strokeWidth={2} />
                  <CraftCountdown endsAt={craft.craft_ends_at} />
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Catálogo de crafteo ──────────────────────────────────────────────────────── */

function CraftingCatalog({ catalog, inventory, labLevel, resources, craftPending, queueLength, onCraft, categoryFilter }) {
  const maxSlots = 2 // CRAFTING_SLOTS_BASE
  const slotsAvailable = queueLength < maxSlots

  // Agrupar por categoría
  const byCategory = {}
  for (const recipe of catalog) {
    if (!byCategory[recipe.category]) byCategory[recipe.category] = []
    byCategory[recipe.category].push(recipe)
  }

  const categoryOrder = categoryFilter === 'refining'
    ? ['refining']
    : ['repair', 'upgrade', 'tactic', 'training']

  return (
    <div className="flex flex-col gap-4">
      {/* Inventario de items crafteados */}
      <CraftedInventory inventory={inventory} catalog={catalog} />

      {categoryOrder.map(cat => {
        const recipes = byCategory[cat]
        if (!recipes?.length) return null
        return (
          <div key={cat} className="flex flex-col gap-2">
            {categoryFilter !== 'refining' && (
              <h4 className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-3 px-1">
                {CATEGORY_LABELS[cat] ?? cat}
              </h4>
            )}
            <div className="flex flex-col gap-2">
              {recipes.map(recipe => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  qty={inventory[recipe.id] ?? 0}
                  labLevel={labLevel}
                  resources={resources}
                  inventory={inventory}
                  craftPending={craftPending}
                  slotsAvailable={slotsAvailable}
                  onCraft={onCraft}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CraftedInventory({ inventory, catalog }) {
  const catalogMap = Object.fromEntries((catalog ?? []).map(c => [c.id, c]))
  const items = Object.entries(inventory).filter(([, qty]) => qty > 0)
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-3">Inventario</span>
      <div className="flex gap-2 flex-wrap">
        {items.map(([id, qty]) => {
          const recipe = catalogMap[id]
          return (
            <span key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-border text-[12px] font-semibold text-text-2">
              <span>{recipe?.icon ?? '🔧'}</span>
              {recipe?.name ?? id}
              <span className="text-text-3 ml-0.5">×{qty}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function RecipeCard({ recipe, qty, labLevel, resources, inventory, craftPending, slotsAvailable, onCraft }) {
  const locked = labLevel < recipe.min_lab_level
  const inputs = recipe.inputs ?? []

  const canAfford = inputs.every(inp => {
    if (inp.resource) return (resources?.[inp.resource] ?? 0) >= inp.qty
    if (inp.item)     return (inventory?.[inp.item] ?? 0) >= inp.qty
    return false
  })

  const canCraft = !locked && canAfford && slotsAvailable && !craftPending

  return (
    <div className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border bg-surface ${locked ? 'opacity-50 border-border' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[15px]">{recipe.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-text truncate">{recipe.name}</span>
              {qty > 0 && <span className="text-[11px] text-text-3 font-medium">×{qty}</span>}
            </div>
            {recipe.description && (
              <p className="text-[11px] text-text-3 leading-tight">{recipe.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Ingredientes */}
        <div className="flex items-center gap-2 flex-wrap">
          {inputs.map(inp => {
            const key = inp.resource ?? inp.item
            const needed = inp.qty
            const available = inp.resource
              ? (resources?.[inp.resource] ?? 0)
              : (inventory?.[inp.item] ?? 0)
            const has = available >= needed
            return (
              <span
                key={key}
                className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  color: has ? 'var(--text-2)' : '#dc2626',
                  background: has ? 'var(--surface-2)' : 'color-mix(in srgb, #dc2626 8%, var(--surface))',
                }}
              >
                {needed} {INPUT_LABELS[key] ?? key}
              </span>
            )
          })}
          <span className="flex items-center gap-0.5 text-[10px] text-text-3">
            <Clock size={9} strokeWidth={2} />
            {recipe.craft_minutes}m
          </span>
        </div>

        {locked ? (
          <span className="flex items-center gap-1 text-[11px] text-text-3 font-medium flex-shrink-0">
            <Lock size={10} strokeWidth={2} />
            Taller Nv.{recipe.min_lab_level}
          </span>
        ) : (
          <motion.button
            className="px-3 py-1 text-[11px] font-bold rounded-md border-0 text-white bg-violet-600 transition-opacity disabled:opacity-40 flex-shrink-0"
            onClick={() => onCraft(recipe.id)}
            disabled={!canCraft}
            whileTap={canCraft ? { scale: 0.95 } : {}}
          >
            {recipe.category === 'refining' ? 'Refinar' : 'Craftear'}
          </motion.button>
        )}
      </div>
    </div>
  )
}

/* ── Countdown helper ────────────────────────────────────────────────────────── */

function CraftCountdown({ endsAt }) {
  const [, tick] = useReducer(x => x + 1, 0)
  useEffect(() => {
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return '¡Listo!'
  const secs = Math.ceil(ms / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
