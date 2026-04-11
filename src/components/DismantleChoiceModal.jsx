import { createPortal } from 'react-dom'
import { Coins, Layers, Sparkles, Flame, X } from 'lucide-react'
import { DISMANTLE_GOLD_TABLE, DISMANTLE_TRANSMUTE_TABLE } from '../lib/gameConstants'

function estimateSellGold(item) {
  const base = DISMANTLE_GOLD_TABLE[item.item_catalog.rarity] ?? DISMANTLE_GOLD_TABLE.common
  return base * (item.item_catalog.tier ?? 1)
}

function transmuteEntry(item) {
  return DISMANTLE_TRANSMUTE_TABLE[item.item_catalog.rarity] ?? DISMANTLE_TRANSMUTE_TABLE.common
}

/**
 * Modal con dos opciones para deshacerse de un ítem:
 *   1. Vender al mercader → obtener oro (comportamiento tradicional)
 *   2. Transmutar en el laboratorio → pagar oro + obtener materiales
 */
export default function DismantleChoiceModal({ item, gold = 0, onSell, onTransmute, onCancel }) {
  if (!item) return null

  const sellGold = estimateSellGold(item)
  const trans    = transmuteEntry(item)
  const canAfford = gold >= trans.cost

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6" onClick={onCancel}>
      <div
        className="bg-bg border border-border-2 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col gap-4 p-5"
        style={{ width: 'min(380px, 92vw)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-text">Deshacerse de {item.item_catalog.name}</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-text-3 hover:text-text hover:bg-surface-2 transition-colors" onClick={onCancel}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <p className="text-[12px] text-text-3">
          El ítem se destruirá. Elige cómo procesarlo.
        </p>

        {/* Opción 1: Vender */}
        <button
          type="button"
          className="flex flex-col gap-1.5 px-3 py-3 rounded-xl border border-border bg-surface text-left hover:bg-surface-2 transition-colors"
          onClick={onSell}
        >
          <span className="text-[13px] font-bold text-text">Vender al mercader</span>
          <span className="flex items-center gap-1 text-[12px] text-[#16a34a] font-semibold">
            <Coins size={12} strokeWidth={2.5} />+{sellGold} oro
          </span>
        </button>

        {/* Opción 2: Transmutar */}
        <button
          type="button"
          className="flex flex-col gap-1.5 px-3 py-3 rounded-xl border border-border bg-surface text-left hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onTransmute}
          disabled={!canAfford}
          title={!canAfford ? 'Oro insuficiente' : undefined}
        >
          <span className="text-[13px] font-bold text-text">Transmutar en el laboratorio</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`flex items-center gap-1 text-[12px] font-semibold ${canAfford ? 'text-error-text' : 'text-error-text'}`}>
              <Coins size={12} strokeWidth={2.5} />−{trans.cost}
            </span>
            {trans.fragments > 0 && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-[#16a34a]">
                <Layers size={12} strokeWidth={2.5} />+{trans.fragments}
              </span>
            )}
            {trans.essence > 0 && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-[#16a34a]">
                <Flame size={12} strokeWidth={2.5} />+{trans.essence}
              </span>
            )}
            {trans.mana > 0 && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-[#16a34a]">
                <Sparkles size={12} strokeWidth={2.5} />+{trans.mana}
              </span>
            )}
          </div>
        </button>

        <div className="flex justify-end">
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
