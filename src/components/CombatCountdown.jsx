import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Flame } from 'lucide-react'

/**
 * Cuenta atrás 3-2-1 antes de un combate.
 * Se muestra como modal centrada (portal al body).
 *
 * Props:
 *  - onReady: callback cuando la cuenta llega a 0
 */
export function CombatCountdown({ onReady }) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count <= 0) { onReady(); return }
    const id = setTimeout(() => setCount(c => c - 1), 700)
    return () => clearTimeout(id)
  }, [count, onReady])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex flex-col items-center justify-center gap-5 bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-lg px-10 py-14"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center">
            <Shield size={28} className="text-[#3b82f6] mb-1" strokeWidth={1.8} />
            <span className="text-[#93c5fd] text-[11px] font-bold uppercase tracking-wider">Tú</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={count}
              className="text-[56px] font-black text-text leading-none"
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.3 }}
            >
              {count > 0 ? count : '⚔️'}
            </motion.span>
          </AnimatePresence>
          <div className="flex flex-col items-center">
            <Flame size={28} className="text-[#dc2626] mb-1" strokeWidth={1.8} />
            <span className="text-[#fca5a5] text-[11px] font-bold uppercase tracking-wider">Rival</span>
          </div>
        </div>
        <p className="text-text-3 text-[13px] font-semibold">Preparando combate...</p>
      </motion.div>
    </motion.div>,
    document.body
  )
}
