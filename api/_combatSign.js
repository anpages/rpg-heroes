/**
 * Firma HMAC para tokens de combate pausado ("Momento clave").
 *
 * El token contiene todo el estado necesario para reanudar un combate
 * (stats de ambos lados, hp parcial, log, ronda, contexto del modo de juego)
 * y un timestamp de expiración. Se firma con HMAC-SHA256 para que el cliente
 * no pueda manipular las stats antes de pedir la reanudación.
 *
 * Formato del token: <payloadBase64Url>.<sigBase64Url>
 */
import crypto from 'crypto'

const SECRET =
  process.env.COMBAT_SIGNING_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'dev-only-fallback-do-not-use-in-prod'

const TOKEN_TTL_MS = 5 * 60 * 1000  // 5 minutos para tomar la decisión

function toB64Url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function signCombatToken(payload) {
  const data = { ...payload, expiresAt: Date.now() + TOKEN_TTL_MS }
  const json = JSON.stringify(data)
  const b64  = toB64Url(json)
  const sig  = toB64Url(crypto.createHmac('sha256', SECRET).update(b64).digest())
  return `${b64}.${sig}`
}

export function verifyCombatToken(token) {
  return verifyToken(token, 'Token expirado, vuelve a iniciar el combate')
}

// Verificación común
function verifyToken(token, expiredMsg) {
  if (!token || typeof token !== 'string') throw new Error('Token requerido')
  const dot = token.indexOf('.')
  if (dot < 0) throw new Error('Token malformado')

  const b64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const expectedSig = toB64Url(crypto.createHmac('sha256', SECRET).update(b64).digest())

  // Comparación en tiempo constante para evitar timing attacks
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Firma inválida')
  }

  const json = fromB64Url(b64).toString('utf8')
  const data = JSON.parse(json)
  if (data.expiresAt && data.expiresAt < Date.now()) {
    throw new Error(expiredMsg)
  }
  return data
}
