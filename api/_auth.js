import { createClient } from '@supabase/supabase-js'

/**
 * Verifica método HTTP, extrae token y valida usuario.
 * Retorna { user, supabase } si todo es correcto, o null si ya respondió con error.
 *
 * Uso:
 *   const auth = await requireAuth(req, res)
 *   if (!auth) return
 *   const { user, supabase } = auth
 */
export async function requireAuth(req, res, method = 'POST') {
  if (req.method !== method) {
    res.status(405).end()
    return null
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Sin token' })
    return null
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Token inválido' })
    return null
  }

  return { user, supabase }
}
