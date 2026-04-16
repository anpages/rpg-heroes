import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiPost } from '../lib/api'
import { notify } from '../lib/notifications'
import { queryKeys } from '../lib/queryKeys'

/**
 * Llama a /api/comeback-bonus una sola vez al montar Dashboard.
 * Si el servidor devuelve bonus, invalida recursos y muestra notificación.
 */
export function useComebackBonus(userId) {
  const qc      = useQueryClient()
  const called  = useRef(false)

  useEffect(() => {
    if (!userId || called.current) return
    called.current = true

    apiPost('/api/comeback-bonus', {})
      .then(data => {
        if (!data?.bonus) return
        const { gold, fragments, essence, label } = data.bonus
        qc.invalidateQueries({ queryKey: queryKeys.resources(userId) })

        const parts = [`+${gold} oro`]
        if (fragments > 0) parts.push(`+${fragments} fragmentos`)
        if (essence   > 0) parts.push(`+${essence} esencia`)

        notify.success(`¡Bonus de regreso (${label})! ${parts.join(', ')}`)
      })
      .catch(() => {}) // silencioso — no bloquear la app
  }, [userId, qc])
}
