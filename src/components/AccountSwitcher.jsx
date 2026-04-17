import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { UserPlus, LogOut, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getSavedAccounts, removeAccount, saveAccount } from '../lib/accountManager'
import { notify } from '../lib/notifications'

function Initials({ name, avatar_url, size = 28 }) {
  const letters = (name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()

  if (avatar_url) {
    return (
      <span
        className="rounded-full overflow-hidden flex-shrink-0 block"
        style={{ width: size, height: size, minWidth: size }}
      >
        <img
          src={avatar_url}
          alt={name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </span>
    )
  }

  return (
    <span
      className="rounded-full bg-blue-600 text-white font-semibold flex items-center justify-center flex-shrink-0 text-[12px]"
      style={{ width: size, height: size }}
    >
      {letters || '?'}
    </span>
  )
}

export default function AccountSwitcher({ session, onSwitch }) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(null)

  const accounts = getSavedAccounts()
  const currentId = session?.user?.id
  const others = accounts.filter(a => a.id !== currentId)
  const currentName =
    session?.user?.user_metadata?.full_name ??
    session?.user?.user_metadata?.name ??
    session?.user?.email ??
    '?'
  const currentEmail = session?.user?.email ?? ''
  const currentAvatar = session?.user?.user_metadata?.avatar_url ?? null

  async function handleSwitch(account) {
    if (switching) return
    const fresh = getSavedAccounts().find(a => a.id === account.id) ?? account
    if (!fresh?.access_token || !fresh?.refresh_token) {
      notify.error('Sesión caducada, vuelve a añadir la cuenta')
      return
    }
    setSwitching(account.id)
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: fresh.access_token,
        refresh_token: fresh.refresh_token,
      })
      if (error) throw error
      saveAccount(data.session)
      setSwitching(null)
      setOpen(false)
      onSwitch(data.session)
    } catch (err) {
      notify.error(err?.message ?? 'Error al cambiar de cuenta')
      setSwitching(null)
    }
  }

  async function handleAddAccount() {
    setOpen(false)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function handleLogout() {
    setOpen(false)
    removeAccount(currentId)
    if (others.length > 0) {
      const first = others[0]
      if (first.access_token && first.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: first.access_token,
          refresh_token: first.refresh_token,
        })
        if (!error) { onSwitch(data.session); return }
      }
    }
    await supabase.auth.signOut()
  }

  const sheet = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[200] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />

          <motion.div
            className="fixed bottom-0 inset-x-0 z-[201] mx-auto max-w-sm bg-surface rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)] overflow-hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-4" />

            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest px-5 mb-2">
              Cuenta activa
            </p>

            <div className="flex items-center gap-3 px-5 py-3">
              <Initials name={currentName} avatar_url={currentAvatar} size={40} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text truncate">{currentName}</p>
                <p className="text-[13px] text-text-muted truncate">{currentEmail}</p>
              </div>
              <Check size={16} className="text-blue-500 flex-shrink-0" />
            </div>

            {others.length > 0 && (
              <>
                <div className="h-px bg-border mx-5 my-2" />
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest px-5 mb-2">
                  Otras cuentas
                </p>
                {others.map(account => (
                  <button
                    key={account.id}
                    className="w-full flex items-center gap-3 px-5 py-3 active:bg-surface-2 transition-colors"
                    onClick={() => handleSwitch(account)}
                    disabled={!!switching}
                  >
                    <Initials name={account.name} avatar_url={account.avatar_url} size={40} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[15px] font-medium text-text truncate">{account.name}</p>
                      <p className="text-[13px] text-text-muted truncate">{account.email}</p>
                    </div>
                    {switching === account.id && (
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />
                    )}
                  </button>
                ))}
              </>
            )}

            <div className="h-px bg-border mx-5 my-2" />

            <button
              className="w-full flex items-center gap-3 px-5 py-3.5 active:bg-surface-2 transition-colors"
              onClick={handleAddAccount}
            >
              <span className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center flex-shrink-0">
                <UserPlus size={18} className="text-text-muted" />
              </span>
              <span className="text-[15px] text-text-muted">Añadir cuenta</span>
            </button>

            <button
              className="w-full flex items-center gap-3 px-5 py-3.5 mb-3 active:bg-surface-2 transition-colors"
              onClick={handleLogout}
            >
              <span className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--error-text)_10%,transparent)] flex items-center justify-center flex-shrink-0">
                <LogOut size={18} className="text-error-text" />
              </span>
              <span className="text-[15px] text-error-text">Cerrar sesión</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <button
        className="btn btn--ghost btn--icon rounded-full p-0 overflow-hidden"
        onClick={() => setOpen(true)}
        title="Cuentas"
        style={{ width: 32, height: 32 }}
      >
        <Initials name={currentName} avatar_url={currentAvatar} size={28} />
      </button>

      {createPortal(sheet, document.body)}
    </>
  )
}
