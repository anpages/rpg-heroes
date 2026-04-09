import { Lock, Gem } from 'lucide-react'
import { motion } from 'framer-motion'
import { LAB_BASE_LEVEL_REQUIRED, RUNE_MIN_LAB_LEVEL } from '../../lib/gameConstants.js'
import { cardVariants, BUILDING_META } from './constants.js'
import { baseLevelFromMap } from './helpers.js'
import { BuildingCard } from './BuildingCard.jsx'
import { LaboratorySection, RunesSection } from './LaboratorySection.jsx'

export default function LaboratorioZone({ byType, effectiveResources, potions, crafting, runesCatalog, runesInventory, anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending, craftPending, onCraft, onCollect, onRuneCraft }) {
  const lab       = byType['laboratory']
  const baseLevel = baseLevelFromMap(byType)

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

      {lab.level >= 1 && !lab.upgrade_ends_at && (
        <div className="flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <LaboratorySection
              labLevel={lab.level}
              potions={potions}
              crafting={crafting}
              craftPending={craftPending}
              resources={effectiveResources}
              onCraft={onCraft}
              onCollect={onCollect}
            />
          </div>

          {lab.level >= RUNE_MIN_LAB_LEVEL ? (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
              <RunesSection
                labLevel={lab.level}
                catalog={runesCatalog}
                inventory={runesInventory}
                resources={effectiveResources}
                onCraft={onRuneCraft}
              />
            </div>
          ) : (
            <div className="bc-accent flex flex-col rounded-xl overflow-hidden border border-border bg-surface shadow-[var(--shadow-sm)] opacity-60" style={{ '--accent': '#7c3aed' }}>
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-bg)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
                  <Gem size={18} strokeWidth={1.8} color="#7c3aed" />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-text">Crafteo de Runas</h3>
                  <Lock size={13} strokeWidth={2.5} className="text-text-3 flex-shrink-0" />
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center px-4 py-3 border-y border-border bg-[color-mix(in_srgb,#7c3aed_4%,var(--bg))]">
                <p className="text-[13px] text-text-3 text-center">Incrusta runas en tu equipo para potenciar las estadísticas de tu héroe.</p>
              </div>
              <div className="px-4 py-3">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-text-3">
                  <Lock size={11} strokeWidth={2.5} />
                  Requiere Laboratorio Nv.{RUNE_MIN_LAB_LEVEL} para desbloquear.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
