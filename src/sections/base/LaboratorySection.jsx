import { Coins, Axe, Sparkles, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { EFFECT_COLOR, RUNE_BONUS_LABELS, RUNE_BONUS_COLORS } from './constants.js'

export function LaboratorySection({ labLevel, potions, resources, onCraft }) {
  const availablePotions = potions.filter(p => p.min_lab_level <= labLevel)

  function canAfford(p) {
    if (!resources) return false
    return resources.gold >= p.recipe_gold
      && resources.wood >= p.recipe_wood
      && resources.mana >= p.recipe_mana
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">Recetas disponibles</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {availablePotions.map(p => {
          const affordable = canAfford(p)
          const full       = p.quantity >= 5
          const color      = EFFECT_COLOR[p.effect_type] ?? '#475569'

          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 hover:border-border-2 transition-[border-color] duration-150"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[14px] font-extrabold"
                style={{ background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, color }}
              >
                {p.quantity}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-text truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {p.recipe_gold > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.gold >= p.recipe_gold ? 'text-[#16a34a]' : 'text-error-text'}`}>
                      <Coins size={10} strokeWidth={2} />{p.recipe_gold}
                    </span>
                  )}
                  {p.recipe_wood > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.wood >= p.recipe_wood ? 'text-[#16a34a]' : 'text-error-text'}`}>
                      <Axe size={10} strokeWidth={2} />{p.recipe_wood}
                    </span>
                  )}
                  {p.recipe_mana > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.mana >= p.recipe_mana ? 'text-[#16a34a]' : 'text-error-text'}`}>
                      <Sparkles size={10} strokeWidth={2} />{p.recipe_mana}
                    </span>
                  )}
                  <span className="text-[11px] text-text-3 opacity-60">máx.5</span>
                </div>
              </div>
              <motion.button
                className="btn btn--primary btn--sm flex-shrink-0"
                onClick={() => onCraft(p.id)}
                disabled={!affordable || full}
                whileTap={(!affordable || full) ? {} : { scale: 0.96 }}
                title={full ? 'Inventario lleno' : !affordable ? 'Recursos insuficientes' : undefined}
              >
                <Plus size={13} strokeWidth={2.5} />
              </motion.button>
            </div>
          )
        })}

        {availablePotions.length === 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            Sube el Laboratorio para desbloquear recetas
          </p>
        )}
      </div>
    </div>
  )
}

export function RunesSection({ labLevel, catalog, inventory, resources, onCraft }) {
  const availableRunes = catalog.filter(r => r.min_lab_level <= labLevel)
  const inventoryMap   = Object.fromEntries(inventory.map(ir => [ir.rune_id, ir.quantity]))

  function canAfford(r) {
    if (!resources) return false
    return resources.gold >= r.recipe_gold
      && resources.wood >= r.recipe_wood
      && resources.mana >= r.recipe_mana
  }

  function bonusText(bonuses) {
    return (bonuses ?? []).map(({ stat, value }) => `+${value} ${RUNE_BONUS_LABELS[stat] ?? stat}`).join(' · ')
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">Crafteo de Runas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {availableRunes.map(r => {
          const affordable = canAfford(r)
          const qty        = inventoryMap[r.id] ?? 0
          const mainBonus  = r.bonuses?.[0]
          const color      = RUNE_BONUS_COLORS[mainBonus?.stat] ?? '#475569'

          return (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 hover:border-border-2 transition-[border-color] duration-150"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-extrabold"
                style={{ background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, color }}
              >
                {qty > 0 ? qty : '✦'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-text truncate">{r.name}</p>
                <p className="text-[11px] text-text-3 mt-0.5">{bonusText(r.bonuses)}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {r.recipe_gold > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.gold >= r.recipe_gold ? 'text-[#16a34a]' : 'text-error-text'}`}>
                      <Coins size={10} strokeWidth={2} />{r.recipe_gold}
                    </span>
                  )}
                  {r.recipe_wood > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.wood >= r.recipe_wood ? 'text-[#16a34a]' : 'text-error-text'}`}>
                      <Axe size={10} strokeWidth={2} />{r.recipe_wood}
                    </span>
                  )}
                  {r.recipe_mana > 0 && (
                    <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.mana >= r.recipe_mana ? 'text-[#16a34a]' : 'text-error-text'}`}>
                      <Sparkles size={10} strokeWidth={2} />{r.recipe_mana}
                    </span>
                  )}
                </div>
              </div>
              <motion.button
                className="btn btn--primary btn--sm flex-shrink-0"
                onClick={() => onCraft(r.id)}
                disabled={!affordable}
                whileTap={!affordable ? {} : { scale: 0.96 }}
                title={!affordable ? 'Recursos insuficientes' : undefined}
              >
                <Plus size={13} strokeWidth={2.5} />
              </motion.button>
            </div>
          )
        })}

        {availableRunes.length === 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            Sube el Laboratorio a Nv.2 para desbloquear el crafteo de runas
          </p>
        )}
      </div>
    </div>
  )
}
