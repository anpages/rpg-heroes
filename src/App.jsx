import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import './App.css'

function LoadingScreen() {
  return (
    <div className="app-loading">
      <div className="app-loading-dot" />
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playerExists, setPlayerExists] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setPlayerExists(null)
    })

    return () => subscription.unsubscribe()
  }, [])

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

  if (loading) return <LoadingScreen />
  if (!session) return <LoginPage />
  if (playerExists === null) return <LoadingScreen />
  if (!playerExists) return <Onboarding session={session} onComplete={() => setPlayerExists(true)} />
  return <Dashboard session={session} />
}

export default App
