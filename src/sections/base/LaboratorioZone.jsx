import { Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { LAB_BASE_LEVEL_REQUIRED, LAB_INVENTORY_BASE, LAB_INVENTORY_PER_UPGRADE } from '../../lib/gameConstants.js'
import { cardVariants, BUILDING_META } from './constants.js'
import { baseLevelFromMap } from './helpers.js'
import { BuildingCard } from './BuildingCard.jsx'
import { LaboratorySection, LabInventory } from './LaboratorySection.jsx'

export default function LaboratorioZone({ byType, effectiveResources, potions, potionCraftingMap, anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending, craftPending, collectPending, onCraft, onCollect, onLabInventoryUpgrade, labInventoryUpgradePending }) {
  const lab       = byType['laboratory']
  const baseLevel = baseLevelFromMap(byType)

  // Cómputo de capacidad unificado — activos (crafteando/listos) cuentan
  const labUpgrades  = effectiveResources?.lab_inventory_upgrades ?? 0
  const labCapacity  = LAB_INVENTORY_BASE + labUpgrades * LAB_INVENTORY_PER_UPGRADE
  const potionQty    = (potions ?? []).reduce((s, p) => s + (p.quantity ?? 0), 0)
  const potionCraftCount = Object.values(potionCraftingMap ?? {}).reduce((s, arr) => s + (arr?.length ?? 0), 0)
  const labInventoryUsed = potionQty + potionCraftCount
  const labInventoryFull = labInventoryUsed >= labCapacity

  if (!lab) return null

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

      {lab.level >= 1 && (
        <div className="flex flex-col gap-4">
          {/* Inventario del laboratorio */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <LabInventory
              potions={potions}
              resources={effectiveResources}
              onUpgrade={onLabInventoryUpgrade}
              upgradePending={labInventoryUpgradePending}
              potionCraftingMap={potionCraftingMap}
              onPotionCollect={onCollect}
              potionCollectPending={collectPending}
              inventoryUsed={labInventoryUsed}
              capacity={labCapacity}
            />
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <LaboratorySection
              labLevel={lab.level}
              potions={potions}
              craftingMap={potionCraftingMap}
              craftPending={craftPending}
              resources={effectiveResources}
              onCraft={onCraft}
              isUpgrading={!!lab.upgrade_ends_at}
              inventoryFull={labInventoryFull}
            />
          </div>

        </div>
      )}
    </motion.div>
  )
}
