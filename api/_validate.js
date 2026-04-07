const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Returns true if s is a well-formed UUID v4. */
export function isUUID(s) {
  return typeof s === 'string' && UUID_RE.test(s)
}

/**
 * Elapsed time in HOURS, capped at 24 h to prevent absurd resource accumulation.
 * Use this for resource interpolation — rates are stored as units/hour.
 */
export function safeHours(lastCollectedAt, nowMs = Date.now()) {
  const elapsed = (nowMs - new Date(lastCollectedAt).getTime()) / 3_600_000
  return Math.max(0, Math.min(elapsed, 24))
}

/** @deprecated Use safeHours. Kept only for callers not yet migrated. */
export function safeMinutes(lastCollectedAt, nowMs = Date.now()) {
  return safeHours(lastCollectedAt, nowMs) * 60
}
