import { useMemo } from 'react'
import { supabase } from '../lib/supabase'

const EMBER_COUNT = 22

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function LoginPage() {
  const embers = useMemo(() =>
    Array.from({ length: EMBER_COUNT }, () => ({
      left:              `${4 + Math.random() * 92}%`,
      width:             `${2 + Math.random() * 3}px`,
      height:            `${2 + Math.random() * 4}px`,
      animationDuration: `${5 + Math.random() * 7}s`,
      animationDelay:    `${Math.random() * 8}s`,
    })),
  [])

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      {/* Embers y torch ocultos en tema claro — se muestran en dark */}
      <div className="hidden" aria-hidden="true" />

      {/* Panel */}
      <div className="w-[min(420px,100%)]" role="main">
        <div className="bg-surface border border-border rounded-2xl shadow-[var(--shadow-lg)] px-9 pt-10 pb-9 relative">

          {/* Ornament top */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="flex-1 h-px bg-border" />
            <div className="w-1.5 h-1.5 bg-[var(--blue-400)] rotate-45 flex-shrink-0" />
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Body */}
          <div className="flex flex-col items-center text-center pb-2">
            <p className="font-[inherit] text-[11px] font-semibold tracking-[0.2em] uppercase text-[var(--blue-500)] mb-2.5">
              Tu aventura comienza aquí
            </p>

            <h1 className="flex flex-col items-center gap-0 mb-5">
              <span className="font-display text-[12px] font-semibold tracking-[0.5em] text-text-3 uppercase block">
                RPG
              </span>
              <span className="font-display text-[clamp(40px,10vw,54px)] font-bold text-[var(--blue-700)] block leading-none tracking-[0.02em]">
                Heroes
              </span>
            </h1>

            {/* Divider */}
            <div className="flex items-center gap-2.5 w-full mb-4">
              <div className="flex-1 h-px bg-border" />
              <div className="w-[5px] h-[5px] bg-border-2 rotate-45 flex-shrink-0" />
              <div className="flex-1 h-px bg-border" />
            </div>

            <p className="text-[15px] leading-[1.7] text-text-2 mb-7">
              Forja tu leyenda en el campo de batalla.<br />
              Comanda tu gremio. Conquista la oscuridad.
            </p>

            <button
              className="flex items-center justify-center gap-2.5 w-full px-5 py-3 bg-btn-primary border-0 text-white font-[inherit] text-[15px] font-semibold tracking-[0.01em] rounded-[10px] transition-[background,box-shadow,transform] duration-200 mb-3 hover:bg-btn-primary-hover hover:shadow-[0_4px_16px_rgba(37,99,235,0.35)] active:translate-y-px active:shadow-none"
              onClick={handleGoogleLogin}
            >
              <span className="flex items-center bg-surface rounded-[4px] p-0.5 flex-shrink-0">
                <GoogleIcon />
              </span>
              <span>Entrar con Google</span>
            </button>

            <p className="text-[13px] text-text-3">
              Los nuevos héroes quedan vinculados a su juramento en el primer acceso.
            </p>
          </div>

          {/* Ornament bottom */}
          <div className="flex items-center gap-2.5 mt-6">
            <div className="flex-1 h-px bg-border" />
            <div className="w-1.5 h-1.5 bg-[var(--blue-400)] rotate-45 flex-shrink-0" />
            <div className="flex-1 h-px bg-border" />
          </div>

        </div>
      </div>

      {/* Embers (solo decorativos, ocultos en light mode) */}
      <div className="hidden" aria-hidden="true">
        {embers.map((style, i) => (
          <span key={i} className="ember" style={style} />
        ))}
      </div>
    </div>
  )
}

export default LoginPage
