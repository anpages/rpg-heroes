/**
 * Helpers para llamadas autenticadas a /api/*
 * - No usan refreshSession (innecesario y añade latencia)
 * - Lanzan Error si la respuesta no es ok (compatible con useMutation)
 */
import { supabase } from './supabase'

async function parseResponse(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    // Vercel devuelve texto plano en errores 500 — lanzamos un mensaje legible
    throw new Error(`Error del servidor (${res.status})`)
  }
}

export async function apiPost(endpoint, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  })
  const data = await parseResponse(res)
  if (!res.ok) throw new Error(data.error ?? 'Error')
  return data
}

export async function apiGet(path) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await parseResponse(res)
  if (!res.ok) throw new Error(data.error ?? 'Error')
  return data
}
