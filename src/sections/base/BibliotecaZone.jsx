import { useEffect, useReducer } from 'react'
import { motion } from 'framer-motion'
import { cardVariants } from './constants.js'
import { BuildingCard } from './BuildingCard.jsx'
import { ResearchTree } from './Research.jsx'

export default function BibliotecaZone({ byType, research, resources, onResearchStart, onResearchCollect, startPending, collectPending, anyUpgrading, onUpgradeStart, onUpgradeCollect, onOptimisticDeduct, onUpgradePending }) {
  const library = byType['library']
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useEffect(() => {
    if (!research.active) return
    const id = setInterval(forceUpdate, 1000)
    return () => clearInterval(id)
  }, [research.active])

  return (
    <motion.div className="flex flex-col gap-4" variants={cardVariants} initial="initial" animate="animate">
      {library && (
        <BuildingCard
          building={library}
          resources={resources}
          anyUpgrading={anyUpgrading}
          onUpgradeStart={onUpgradeStart}
          onUpgradeCollect={onUpgradeCollect}
          onOptimisticDeduct={onOptimisticDeduct}
          onUpgradePending={onUpgradePending}
        />
      )}

      <ResearchTree
        research={research}
        resources={resources}
        onStart={onResearchStart}
        onCollect={onResearchCollect}
        startPending={startPending}
        collectPending={collectPending}
      />
    </motion.div>
  )
}
