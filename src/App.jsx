import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { useAppStore } from './store/appStore'
import { queryClient } from './lib/queryClient'
import { saveAccount } from './lib/accountManager'
import LoginPage from './pages/LoginPage'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import InstallPrompt from './components/InstallPrompt'
import { AnimatePresence, motion } from 'framer-motion'

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
}

function LoadingScreen() {
  return (
    <motion.div className="min-h-screen bg-bg flex items-center justify-center" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse-dot" />
    </motion.div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playerExists, setPlayerExists] = useState(null)
  const setUserId = useAppStore(s => s.setUserId)
  const prevUserIdRef = useRef(null)

  // Callback explícito para cambio de cuenta — no depende de onAuthStateChange
  const handleAccountSwitch = useCallback((newSession) => {
    saveAccount(newSession)
    queryClient.clear()
    prevUserIdRef.current = newSession.user.id
    setPlayerExists(null)
    setSession(newSession)
    setUserId(newSession.user.id)
  }, [setUserId])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) saveAccount(session)
      setSession(session)
      setUserId(session?.user?.id ?? null)
      prevUserIdRef.current = session?.user?.id ?? null
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) saveAccount(session)
      const newId = session?.user?.id ?? null
      const prevId = prevUserIdRef.current
      if (!session) {
        setPlayerExists(null)
        queryClient.clear()
      } else if (prevId && prevId !== newId) {
        setPlayerExists(null)
        queryClient.clear()
      }
      prevUserIdRef.current = newId
      setSession(session)
      setUserId(newId)
    })

    return () => subscription.unsubscribe()
  }, [setUserId])

  useEffect(() => {
    if (!session) return

    supabase
      .from('players')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPlayerExists(!!data)
      })
  }, [session])

  // Determinar qué página mostrar y su key para AnimatePresence
  let pageContent
  if (loading || (session && playerExists === null)) {
    pageContent = <LoadingScreen key="loading" />
  } else if (!session) {
    pageContent = (
      <motion.div key="login" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ minHeight: '100vh' }}>
        <LoginPage />
      </motion.div>
    )
  } else if (!playerExists) {
    pageContent = (
      <motion.div key="onboarding" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ minHeight: '100vh' }}>
        <Onboarding onComplete={() => { queryClient.clear(); setPlayerExists(true) }} />
      </motion.div>
    )
  } else {
    pageContent = (
      <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ height: '100vh' }}>
        <Dashboard session={session} onAccountSwitch={handleAccountSwitch} />
        <InstallPrompt />
      </motion.div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      {pageContent}
    </AnimatePresence>
  )
}

export default App
