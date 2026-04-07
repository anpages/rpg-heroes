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
// Cuando el nuevo SW activa (skipWaiting ya está en autoUpdate), recarga la
// página para que el usuario reciba el código actualizado sin hacer nada.
if ('serviceWorker' in navigator) {
  // Reload al activar el nuevo SW
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      reloading = true
      window.location.reload()
    }
  })

  // Al volver a primer plano, comprobar si hay una versión nueva disponible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      navigator.serviceWorker.getRegistration().then(reg => reg?.update())
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
