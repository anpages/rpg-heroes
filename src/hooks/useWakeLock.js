import { useEffect, useRef } from 'react'

/**
 * Solicita un Wake Lock para evitar que la pantalla se apague.
 * Se activa cuando `active` es true (ej: expedición en curso).
 */
export function useWakeLock(active) {
  const lockRef = useRef(null)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    async function acquire() {
      try {
        lockRef.current = await navigator.wakeLock.request('screen')
      } catch {
        // El sistema puede denegar el lock (ej: batería baja)
      }
    }

    async function release() {
      if (lockRef.current) {
        await lockRef.current.release()
        lockRef.current = null
      }
    }

    if (active) {
      acquire()
    } else {
      release()
    }

    // Reactivar si la página vuelve a ser visible (ej: al salir de otra app)
    function onVisibilityChange() {
      if (active && document.visibilityState === 'visible' && !lockRef.current) {
        acquire()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      release()
    }
  }, [active])
}
