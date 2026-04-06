const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Returns true if s is a well-formed UUID v4. */
export function isUUID(s) {
  return typeof s === 'string' && UUID_RE.test(s)
}

/**
 * Clamps elapsed minutes to at most 24 h to prevent absurd resource
 * accumulation from clock skew or very stale last_collected_at values.
 */
export function safeMinutes(lastCollectedAt, nowMs = Date.now()) {
  const elapsed = (nowMs - new Date(lastCollectedAt).getTime()) / 60000
  return Math.max(0, Math.min(elapsed, 1440)) // cap at 24 h
}
