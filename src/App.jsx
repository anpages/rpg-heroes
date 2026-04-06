import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useAppStore } from './store/appStore'
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUserId(session?.user?.id ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUserId(session?.user?.id ?? null)
      if (!session) setPlayerExists(null)
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
        <Onboarding onComplete={() => setPlayerExists(true)} />
      </motion.div>
    )
  } else {
    pageContent = (
      <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ height: '100vh' }}>
        <Dashboard session={session} />
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
