import { motion } from 'framer-motion'
import { cardVariants, PRODUCTION_TYPES } from './constants.js'
import { BuildingCard, LockedBuildingCard } from './BuildingCard.jsx'
import { EnergyStrip } from './EnergyStrip.jsx'

export default function RecursosZone({ byType, effectiveResources, nexusData, nexusRatio, anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending }) {
  const resourceBuildings = ['energy_nexus', 'lumber_mill', 'gold_mine', 'mana_well']

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <EnergyStrip nexusData={nexusData} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {resourceBuildings.map(type => {
          const b = byType[type]
          if (!b) return null
          if (b.unlocked === false) return <LockedBuildingCard key={type} type={type} />
          return (
            <BuildingCard
              key={b.id}
              building={b}
              resources={effectiveResources}
              nexusRatio={PRODUCTION_TYPES.includes(type) ? nexusRatio : undefined}
              anyUpgrading={anyUpgrading}
              onUpgradeStart={onUpgradeStart}
              onUpgradeCollect={onUpgradeCollect}
              onOptimisticDeduct={onOptimisticDeduct}
              onUpgradePending={onUpgradePending}
            />
          )
        })}
      </div>
    </motion.div>
  )
}
