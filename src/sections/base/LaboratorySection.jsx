import { useState, useEffect, useReducer } from 'react'
import { Coins, Axe, Sparkles, Layers, Flame, Plus, Clock, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { EFFECT_COLOR, RUNE_BONUS_LABELS, RUNE_BONUS_COLORS } from './constants.js'
import ScrollHint from '../../components/ScrollHint.jsx'

function formatMs(ms) {
  if (ms <= 0) return '0:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function useTickWhileActive(hasAnyCrafting) {
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  useEffect(() => {
    if (!hasAnyCrafting) return
    const id = setInterval(forceUpdate, 1000)
    return () => clearInterval(id)
  }, [hasAnyCrafting])
}

/* ─── Pills de filtro reutilizables ──────────────────────────────────────────── */

function FilterPills({ options, value, onChange }) {
  return (
    <ScrollHint>
      {options.map(o => {
        const active = value === o.value
        // craft: 'ready' | 'crafting' | null
        const dot = o.craft === 'ready' ? '#16a34a' : o.craft === 'crafting' ? '#d97706' : null
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`relative flex-shrink-0 px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors duration-150 ${
              active
                ? 'bg-[#2563eb] text-white'
                : 'bg-surface-2 text-text-3 hover:text-text-2'
            }`}
          >
            {o.label}{o.count != null ? ` (${o.count})` : ''}
            {dot && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-surface"
                style={{ background: dot }}
              />
            )}
          </button>
        )
      })}
    </ScrollHint>
  )
}

/* ─── Constantes de filtros ──────────────────────────────────────────────────── */

const POTION_FILTER_LABELS = {
  all:        'Todas',
  hp_restore: 'Vida',
  atk_boost:  'Ataque',
  def_boost:  'Defensa',
  xp_boost:   'Experiencia',
}

const RUNE_FILTER_LABELS = {
  all:          'Todas',
  attack:       'Ataque',
  defense:      'Defensa',
  agility:      'Agilidad',
  intelligence: 'Inteligencia',
  max_hp:       'Vida',
  multi:        'Combinadas',
}

/* ─── Sección de Pociones ────────────────────────────────────────────────────── */

export function LaboratorySection({ labLevel, potions, craftingMap, craftPending, collectPending, resources, onCraft, onCollect, isUpgrading = false }) {
  const availablePotions = potions.filter(p => p.min_lab_level <= labLevel)
  const hasAnyCrafting = Object.values(craftingMap).some(c => new Date(c.craft_ends_at) > new Date())
  useTickWhileActive(hasAnyCrafting)

  // Ordenar categorías por min_lab_level de su primera aparición
  const typeFirst = {}
  for (const p of availablePotions) {
    if (!(p.effect_type in typeFirst) || p.min_lab_level < typeFirst[p.effect_type]) {
      typeFirst[p.effect_type] = p.min_lab_level
    }
  }
  const typeCounts = {}
  for (const p of availablePotions) {
    typeCounts[p.effect_type] = (typeCounts[p.effect_type] ?? 0) + 1
  }
  // Estado de crafteo por categoría
  const typeCraft = {}
  const now = Date.now()
  for (const p of availablePotions) {
    const craft = craftingMap[p.id]
    if (!craft) continue
    const remaining = new Date(craft.craft_ends_at) - now
    const state = remaining <= 0 ? 'ready' : 'crafting'
    // ready tiene prioridad sobre crafting
    if (!typeCraft[p.effect_type] || state === 'ready') {
      typeCraft[p.effect_type] = state
    }
  }

  const sortedTypes = Object.keys(typeFirst).sort((a, b) => typeFirst[a] - typeFirst[b])
  const filterOptions = sortedTypes.map(type => ({
    value: type,
    label: POTION_FILTER_LABELS[type] ?? type,
    count: typeCounts[type] ?? 0,
    craft: typeCraft[type] ?? null,
  }))

  const [filter, setFilter] = useState(() => sortedTypes[0] ?? 'hp_restore')

  const filtered = availablePotions.filter(p => p.effect_type === filter)

  function canAfford(p) {
    if (!resources) return false
    return resources.gold >= p.recipe_gold
      && resources.wood >= p.recipe_wood
      && resources.mana >= p.recipe_mana
      && (resources.fragments ?? 0) >= (p.recipe_fragments ?? 0)
      && (resources.essence   ?? 0) >= (p.recipe_essence   ?? 0)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">Recetas disponibles</p>

      {filterOptions.length > 1 && (
        <FilterPills options={filterOptions} value={filter} onChange={setFilter} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filtered.map(p => {
          const craft      = craftingMap[p.id]
          const remaining  = craft ? Math.max(0, new Date(craft.craft_ends_at) - Date.now()) : null
          const isReady    = remaining !== null && remaining <= 0
          const isCrafting = remaining !== null && remaining > 0
          const affordable = canAfford(p)
          const full       = p.quantity >= 5
          const disabled   = !affordable || full || isCrafting || craftPending || isUpgrading
          const color      = EFFECT_COLOR[p.effect_type] ?? '#475569'

          const totalMs  = (p.craft_minutes ?? 30) * 60_000
          const progress = isCrafting
            ? Math.min(100, ((totalMs - remaining) / totalMs) * 100)
            : isReady ? 100 : 0

          const borderColor = craft
            ? (isReady ? '#16a34a' : isCrafting ? '#d97706' : undefined)
            : undefined

          return (
            <div
              key={p.id}
              className="flex flex-col rounded-xl overflow-hidden border bg-surface transition-[border-color] duration-150"
              style={{ borderColor: borderColor ?? 'var(--border)' }}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[14px] font-extrabold"
                  style={{ background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, color }}
                >
                  {p.quantity}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-text truncate">{p.name}</p>
                  {isCrafting ? (
                    <p className="flex items-center gap-1 text-[12px] font-semibold text-[#d97706] mt-0.5">
                      <Clock size={11} strokeWidth={2} />
                      {formatMs(remaining)}
                    </p>
                  ) : isReady ? (
                    <p className="text-[12px] font-semibold text-[#16a34a] mt-0.5">¡Lista para recoger!</p>
                  ) : (
                    <>
                      {p.description && <p className="text-[13px] text-text-3 mt-0.5 line-clamp-2 leading-snug">{p.description}</p>}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {p.recipe_gold > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.gold >= p.recipe_gold ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Coins size={10} strokeWidth={2} />{p.recipe_gold}
                          </span>
                        )}
                        {p.recipe_mana > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.mana >= p.recipe_mana ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Sparkles size={10} strokeWidth={2} />{p.recipe_mana}
                          </span>
                        )}
                        {p.recipe_wood > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.wood >= p.recipe_wood ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Axe size={10} strokeWidth={2} />{p.recipe_wood}
                          </span>
                        )}
                        {p.recipe_fragments > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${(resources?.fragments ?? 0) >= p.recipe_fragments ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Layers size={10} strokeWidth={2} />{p.recipe_fragments}
                          </span>
                        )}
                        {p.recipe_essence > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${(resources?.essence ?? 0) >= p.recipe_essence ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Flame size={10} strokeWidth={2} />{p.recipe_essence}
                          </span>
                        )}
                        <span className="flex items-center gap-[3px] text-[11px] text-text-3 opacity-60">
                          <Clock size={9} strokeWidth={2} />{p.craft_minutes ?? 30}m
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {isReady ? (
                  <motion.button
                    className="btn btn--sm flex-shrink-0 font-semibold"
                    style={{ background: '#16a34a', color: '#fff', borderColor: 'transparent' }}
                    onClick={() => onCollect(p.id)}
                    disabled={collectPending}
                    whileTap={collectPending ? {} : { scale: 0.96 }}
                  >
                    <CheckCircle size={13} strokeWidth={2.5} />
                    Recoger
                  </motion.button>
                ) : (
                  <motion.button
                    className="btn btn--primary btn--sm flex-shrink-0"
                    onClick={() => onCraft(p.id)}
                    disabled={disabled}
                    whileTap={disabled ? {} : { scale: 0.96 }}
                    title={full ? 'Inventario lleno' : isCrafting ? 'Crafteando...' : !affordable ? 'Recursos insuficientes' : undefined}
                  >
                    <Plus size={13} strokeWidth={2.5} />
                  </motion.button>
                )}
              </div>

              {(isCrafting || isReady) && (
                <div className="h-1 bg-[var(--surface-2)]">
                  <div
                    className="h-full transition-[width] duration-1000"
                    style={{
                      width: `${progress}%`,
                      background: isReady ? '#16a34a' : '#d97706',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && availablePotions.length > 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            No hay recetas en esta categoría
          </p>
        )}

        {availablePotions.length === 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            Sube el Laboratorio para desbloquear recetas
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── Sección de Runas ───────────────────────────────────────────────────────── */

export function RunesSection({ labLevel, catalog, inventory, resources, craftingMap, craftPending, collectPending, onCraft, onCollect, isUpgrading = false }) {
  const availableRunes = catalog.filter(r => r.min_lab_level <= labLevel)
  const inventoryMap   = Object.fromEntries(inventory.map(ir => [ir.rune_id, ir.quantity]))
  const hasAnyCrafting = Object.values(craftingMap).some(c => new Date(c.craft_ends_at) > new Date())
  useTickWhileActive(hasAnyCrafting)

  // Clasificar: multi = más de 1 stat, single = stat principal
  function runeCategory(r) {
    if ((r.bonuses ?? []).length > 1) return 'multi'
    return r.bonuses?.[0]?.stat ?? 'attack'
  }

  // Ordenar categorías por min_lab_level de su primera aparición
  const catFirst = {}
  for (const r of availableRunes) {
    const cat = runeCategory(r)
    if (!(cat in catFirst) || r.min_lab_level < catFirst[cat]) {
      catFirst[cat] = r.min_lab_level
    }
  }
  const catCounts = {}
  for (const r of availableRunes) {
    const cat = runeCategory(r)
    catCounts[cat] = (catCounts[cat] ?? 0) + 1
  }
  // Estado de crafteo por categoría
  const catCraft = {}
  const now = Date.now()
  for (const r of availableRunes) {
    const craft = craftingMap[r.id]
    if (!craft) continue
    const remaining = new Date(craft.craft_ends_at) - now
    const state = remaining <= 0 ? 'ready' : 'crafting'
    const cat = runeCategory(r)
    if (!catCraft[cat] || state === 'ready') {
      catCraft[cat] = state
    }
  }

  const sortedCats = Object.keys(catFirst).sort((a, b) => catFirst[a] - catFirst[b])
  const filterOptions = sortedCats.map(cat => ({
    value: cat,
    label: RUNE_FILTER_LABELS[cat] ?? cat,
    count: catCounts[cat] ?? 0,
    craft: catCraft[cat] ?? null,
  }))

  const [filter, setFilter] = useState(() => sortedCats[0] ?? 'attack')

  const filtered = availableRunes.filter(r => runeCategory(r) === filter)

  function canAfford(r) {
    if (!resources) return false
    return (resources.gold      ?? 0) >= (r.recipe_gold      ?? 0)
        && (resources.wood      ?? 0) >= (r.recipe_wood      ?? 0)
        && (resources.mana      ?? 0) >= (r.recipe_mana      ?? 0)
        && (resources.fragments ?? 0) >= (r.recipe_fragments ?? 0)
        && (resources.essence   ?? 0) >= (r.recipe_essence   ?? 0)
  }

  function bonusText(bonuses) {
    return (bonuses ?? []).map(({ stat, value }) => `+${value} ${RUNE_BONUS_LABELS[stat] ?? stat}`).join(' · ')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">Crafteo de Runas</p>

      {filterOptions.length > 1 && (
        <FilterPills options={filterOptions} value={filter} onChange={setFilter} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filtered.map(r => {
          const craft      = craftingMap[r.id]
          const remaining  = craft ? Math.max(0, new Date(craft.craft_ends_at) - Date.now()) : null
          const isReady    = remaining !== null && remaining <= 0
          const isCrafting = remaining !== null && remaining > 0
          const affordable = canAfford(r)
          const qty        = inventoryMap[r.id] ?? 0
          const mainBonus  = r.bonuses?.[0]
          const color      = RUNE_BONUS_COLORS[mainBonus?.stat] ?? '#475569'
          const disabled   = !affordable || isCrafting || craftPending || isUpgrading

          const totalMs  = (r.craft_minutes ?? 60) * 60_000
          const progress = isCrafting
            ? Math.min(100, ((totalMs - remaining) / totalMs) * 100)
            : isReady ? 100 : 0

          const borderColor = craft
            ? (isReady ? '#16a34a' : isCrafting ? '#d97706' : undefined)
            : undefined

          return (
            <div
              key={r.id}
              className="flex flex-col rounded-xl overflow-hidden border bg-surface transition-[border-color] duration-150"
              style={{ borderColor: borderColor ?? 'var(--border)' }}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-extrabold"
                  style={{ background: `color-mix(in srgb,${color} 10%,var(--surface-2))`, color }}
                >
                  {qty > 0 ? qty : '✦'}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-text truncate">{r.name}</p>
                  {isCrafting ? (
                    <p className="flex items-center gap-1 text-[12px] font-semibold text-[#d97706] mt-0.5">
                      <Clock size={11} strokeWidth={2} />
                      {formatMs(remaining)}
                    </p>
                  ) : isReady ? (
                    <p className="text-[12px] font-semibold text-[#16a34a] mt-0.5">¡Lista para recoger!</p>
                  ) : (
                    <>
                      <p className="text-[11px] text-text-3 mt-0.5">{bonusText(r.bonuses)}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {(r.recipe_gold ?? 0) > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.gold >= r.recipe_gold ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Coins size={10} strokeWidth={2} />{r.recipe_gold}
                          </span>
                        )}
                        {(r.recipe_mana ?? 0) > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.mana >= r.recipe_mana ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Sparkles size={10} strokeWidth={2} />{r.recipe_mana}
                          </span>
                        )}
                        {(r.recipe_wood ?? 0) > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${resources?.wood >= r.recipe_wood ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Axe size={10} strokeWidth={2} />{r.recipe_wood}
                          </span>
                        )}
                        {(r.recipe_fragments ?? 0) > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${(resources?.fragments ?? 0) >= r.recipe_fragments ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Layers size={10} strokeWidth={2} />{r.recipe_fragments}
                          </span>
                        )}
                        {(r.recipe_essence ?? 0) > 0 && (
                          <span className={`flex items-center gap-[3px] text-[11px] font-semibold ${(resources?.essence ?? 0) >= r.recipe_essence ? 'text-[#16a34a]' : 'text-error-text'}`}>
                            <Flame size={10} strokeWidth={2} />{r.recipe_essence}
                          </span>
                        )}
                        <span className="flex items-center gap-[3px] text-[11px] text-text-3 opacity-60">
                          <Clock size={9} strokeWidth={2} />{r.craft_minutes ?? 60}m
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {isReady ? (
                  <motion.button
                    className="btn btn--sm flex-shrink-0 font-semibold"
                    style={{ background: '#16a34a', color: '#fff', borderColor: 'transparent' }}
                    onClick={() => onCollect(r.id)}
                    disabled={collectPending}
                    whileTap={collectPending ? {} : { scale: 0.96 }}
                  >
                    <CheckCircle size={13} strokeWidth={2.5} />
                    Recoger
                  </motion.button>
                ) : (
                  <motion.button
                    className="btn btn--primary btn--sm flex-shrink-0"
                    onClick={() => onCraft(r.id)}
                    disabled={disabled}
                    whileTap={disabled ? {} : { scale: 0.96 }}
                    title={isCrafting ? 'Crafteando...' : !affordable ? 'Recursos insuficientes' : undefined}
                  >
                    <Plus size={13} strokeWidth={2.5} />
                  </motion.button>
                )}
              </div>

              {(isCrafting || isReady) && (
                <div className="h-1 bg-[var(--surface-2)]">
                  <div
                    className="h-full transition-[width] duration-1000"
                    style={{
                      width: `${progress}%`,
                      background: isReady ? '#16a34a' : '#d97706',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && availableRunes.length > 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            No hay runas en esta categoría
          </p>
        )}

        {availableRunes.length === 0 && (
          <p className="text-[13px] text-text-3 col-span-2 py-6 text-center">
            Sube el Laboratorio a Nv.2 para desbloquear el crafteo de runas
          </p>
        )}
      </div>
    </div>
  )
}
