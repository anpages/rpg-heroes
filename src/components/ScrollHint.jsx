import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * Wrapper for horizontally-scrollable pill containers.
 * Shows a gradient + arrow on the right when more content is available,
 * and a subtle left gradient when scrolled past the start.
 */
export default function ScrollHint({ children, className = '' }) {
  const ref = useRef(null)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)

  const check = useCallback(() => {
    const el = ref.current
    if (!el) return
    const tolerance = 2
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - tolerance)
    setCanScrollLeft(el.scrollLeft > tolerance)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [check])

  return (
    <div className={`relative ${className}`}>
      {/* Scrollable container */}
      <div
        ref={ref}
        className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mb-px pr-5"
      >
        {children}
      </div>

      {/* Left fade */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-[1px] w-6 pointer-events-none"
          style={{ background: 'linear-gradient(to right, var(--color-surface), transparent)' }} />
      )}

      {/* Right fade + arrow */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-[1px] w-10 flex items-center justify-end pointer-events-none pr-0.5"
          style={{ background: 'linear-gradient(to left, var(--color-surface) 30%, transparent)' }}>
          <ChevronRight size={14} strokeWidth={2.5} className="text-text-3 animate-pulse" />
        </div>
      )}
    </div>
  )
}
