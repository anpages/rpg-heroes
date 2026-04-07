import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { queryClient } from './lib/queryClient'
import './index.css'
import App from './App.jsx'

// ── Auto-update PWA ──────────────────────────────────────────────────────────
// Cuando el SW detecta una actualización NO recargamos inmediatamente
// (provoca layout glitches en iOS PWA con safe-area-inset).
// En su lugar marcamos que hay una versión nueva y recargamos la próxima vez
// que el usuario vuelva a la app desde background (visibilitychange).
if ('serviceWorker' in navigator) {
  let needsReload = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    needsReload = true
    // Si la página está en background, recargamos ya (no hay UI visible)
    if (document.hidden) window.location.reload()
  })

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (needsReload) {
        // Volver al primer plano con versión nueva pendiente → recarga limpia
        window.location.reload()
      } else {
        // Sin actualización pendiente: comprobar si hay nueva versión disponible
        navigator.serviceWorker.getRegistration().then(reg => reg?.update())
      }
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="bottom-center"
        toastOptions={{ duration: 3500 }}
        richColors
      />
      <Analytics />
      <SpeedInsights />
    </QueryClientProvider>
  </StrictMode>,
)
