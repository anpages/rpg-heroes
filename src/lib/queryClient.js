import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,   // 30s antes de considerar datos obsoletos
      gcTime:               5 * 60_000, // 5min en caché tras desmontar
      retry:                1,
      refetchOnWindowFocus: true,     // refresca al volver al tab
      refetchOnReconnect:   true,     // refresca al recuperar conexión
    },
  },
})
