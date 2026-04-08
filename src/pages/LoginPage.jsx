import { motion } from 'framer-motion'
import { Sword, Shield, Building2, Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'

/* ── Partículas flotantes ─────────────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left:     `${2 + Math.random() * 96}%`,
  size:     `${1 + Math.random() * 2.5}px`,
  duration: `${10 + Math.random() * 14}s`,
  delay:    `${Math.random() * 12}s`,
  drift:    `${-30 + Math.random() * 60}px`,
}))

/* ── Features ─────────────────────────────────────────────────────────────── */
const FEATURES = [
  { Icon: Sword,     label: 'Héroes',    color: '#f97316' },
  { Icon: Shield,    label: 'Mazmorras', color: '#3b82f6' },
  { Icon: Building2, label: 'Base',      color: '#10b981' },
  { Icon: Trophy,    label: 'Torre',     color: '#a855f7' },
]

/* ── Google icon ──────────────────────────────────────────────────────────── */
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

/* ── Variantes de animación ───────────────────────────────────────────────── */
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.12 } },
}

/* ── Componente ───────────────────────────────────────────────────────────── */
function LoginPage() {
  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: '#06030f' }}
    >
      {/* ── Orbes de fondo animados ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* Orbe 1 — azul */}
        <div style={{
          position: 'absolute', top: '15%', left: '10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'login-orb-1 18s ease-in-out infinite',
        }} />
        {/* Orbe 2 — púrpura */}
        <div style={{
          position: 'absolute', bottom: '10%', right: '8%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)',
          filter: 'blur(50px)',
          animation: 'login-orb-2 22s ease-in-out infinite',
        }} />
        {/* Orbe 3 — naranja tenue */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 350, height: 350, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'translate(-50%, -50%)',
          animation: 'login-orb-3 26s ease-in-out infinite',
        }} />
      </div>

      {/* ── Partículas flotantes ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {PARTICLES.map(p => (
          <span key={p.id} style={{
            position: 'absolute',
            bottom: '-10px',
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'rgba(148,163,184,0.5)',
            '--drift': p.drift,
            animation: `login-particle ${p.duration} ${p.delay} linear infinite`,
          }} />
        ))}
      </div>

      {/* ── Contenido ── */}
      <motion.div
        className="relative z-10 flex flex-col items-center px-6 w-full max-w-[480px]"
      style={{ paddingTop: 'max(32px, env(safe-area-inset-top, 16px))', paddingBottom: 'max(32px, env(safe-area-inset-bottom, 16px))' }}
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {/* Eyebrow */}
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#3b82f6',
            marginBottom: 16,
          }}
        >
          Idle RPG · Forja tu leyenda
        </motion.p>

        {/* Título */}
        <motion.h1
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="text-center"
          style={{ marginBottom: 8 }}
        >
          <span style={{
            display: 'block',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(72px, 22vw, 120px)',
            lineHeight: 0.9,
            letterSpacing: '0.06em',
            color: '#fff',
            textShadow: '0 0 60px rgba(59,130,246,0.6), 0 0 120px rgba(59,130,246,0.25)',
          }}>
            RPG
          </span>
          <span style={{
            display: 'block',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(72px, 22vw, 120px)',
            lineHeight: 0.9,
            letterSpacing: '0.06em',
            color: '#3b82f6',
            textShadow: '0 0 40px rgba(59,130,246,0.8), 0 0 100px rgba(59,130,246,0.35)',
          }}>
            Legends
          </span>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          style={{
            fontSize: 16,
            color: 'rgba(203,213,225,0.75)',
            textAlign: 'center',
            lineHeight: 1.6,
            marginBottom: 36,
            marginTop: 20,
          }}
        >
          Construye tu base. Entrena a tus héroes.<br />
          Conquista la torre. Escribe tu leyenda.
        </motion.p>

        {/* Features */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            width: '100%',
            marginBottom: 36,
          }}
        >
          {FEATURES.map(({ Icon, label, color }) => (
            <div key={label} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '12px 8px',
              borderRadius: 12,
              border: `1px solid rgba(255,255,255,0.07)`,
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `color-mix(in srgb, ${color} 15%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={17} strokeWidth={1.8} color={color} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(203,213,225,0.8)', letterSpacing: '0.04em' }}>
                {label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Login card */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          style={{
            width: '100%',
            padding: '28px 28px 24px',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 4, textAlign: 'center' }}>
            Empieza a jugar
          </p>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', textAlign: 'center', marginBottom: 20 }}>
            Accede con tu cuenta de Google y únete a la leyenda
          </p>

          <button
            onClick={handleGoogleLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              padding: '13px 20px',
              borderRadius: 12,
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.01em',
              boxShadow: '0 4px 24px rgba(59,130,246,0.4)',
              transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#2563eb'
              e.currentTarget.style.boxShadow = '0 6px 32px rgba(59,130,246,0.55)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#3b82f6'
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(59,130,246,0.4)'
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(1px)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <span style={{ display: 'flex', background: '#fff', borderRadius: 5, padding: 2 }}>
              <GoogleIcon />
            </span>
            Entrar con Google
          </button>

          <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.8)', textAlign: 'center', marginTop: 14 }}>
            Primera vez aquí — se creará tu cuenta automáticamente.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default LoginPage
