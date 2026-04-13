import { motion } from 'framer-motion'
import { cardVariants } from './constants.js'
import { LockedBuildingCard } from './BuildingCard.jsx'
import ProductionCard from './ProductionCard.jsx'

/**
 * Zona de Producción: edificios productivos con stock integrado en cada card.
 */
export default function RecursosZone({
  byType,
  production,
  onCollect,
  anyUpgrading,
  effectiveResources,
  onUpgradeStart,
  onUpgradeCollect,
  onOptimisticDeduct,
  onUpgradePending,
}) {
  const resourceBuildings = ['gold_mine', 'lumber_mill', 'herb_garden', 'mana_well']

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {resourceBuildings.map(type => {
          const b = byType[type]
          if (!b) return null
          if (b.unlocked === false) return <LockedBuildingCard key={type} type={type} />

          return (
            <ProductionCard
              key={b.id}
              building={b}
              prod={production[type]}
              resources={effectiveResources}
              anyUpgrading={anyUpgrading}
              onCollect={onCollect}
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
